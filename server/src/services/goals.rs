use crate::{
    error::{Error, Result, require},
    models::{
        achieved_day, daily_task_completion, day_goal_requirement as requirement, pushup_set,
        reading_progress, ride, settings,
    },
    time,
};
use chrono::{Datelike, NaiveDate};
use chrono_tz::Tz;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait,
    IntoActiveModel, QueryFilter, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;

const TIERS: [&str; 3] = ["GOLD", "SILVER", "BRONZE"];
const METRICS: [&str; 4] = ["PUSHUPS", "ELEVATION", "READING_MINUTES", "DAILY_TASKS"];
#[derive(Deserialize, Serialize)]
pub struct Settings {
    pub tiers: Vec<Tier>,
}
#[derive(Deserialize, Serialize)]
pub struct Tier {
    pub tier: String,
    pub goals: Vec<Goal>,
}
#[derive(Deserialize, Serialize)]
pub struct Goal {
    pub metric: String,
    pub required: bool,
    pub goal: Option<i32>,
}
fn view(rows: &[requirement::Model]) -> Settings {
    Settings {
        tiers: TIERS
            .iter()
            .map(|tier| Tier {
                tier: (*tier).into(),
                goals: METRICS
                    .iter()
                    .map(|metric| {
                        let goal = rows
                            .iter()
                            .find(|r| r.tier == *tier && r.metric == *metric)
                            .map(|r| r.goal);
                        Goal {
                            metric: (*metric).into(),
                            required: goal.is_some(),
                            goal,
                        }
                    })
                    .collect(),
            })
            .collect(),
    }
}
pub async fn get(db: &DatabaseConnection) -> Result<Settings> {
    Ok(view(&requirement::Entity::find().all(db).await?))
}
pub async fn update(db: &DatabaseConnection, input: Settings) -> Result<Settings> {
    require(
        input.tiers.len() == 3
            && input
                .tiers
                .iter()
                .map(|t| t.tier.as_str())
                .collect::<BTreeSet<_>>()
                == BTreeSet::from(TIERS),
        "Every tier must be configured exactly once",
    )?;
    let mut rows = vec![];
    for tier in input.tiers {
        let mut seen = BTreeSet::new();
        for g in tier.goals {
            require(METRICS.contains(&g.metric.as_str()), "Unknown metric")?;
            if g.required {
                require(
                    seen.insert(g.metric.clone())
                        && g.goal.is_some_and(|g| (1..=100000).contains(&g)),
                    "Required goals must be unique and between 1 and 100000",
                )?;
                rows.push(requirement::Model {
                    id: Uuid::new_v4(),
                    tier: tier.tier.clone(),
                    metric: g.metric,
                    goal: g.goal.expect("validated goal"),
                });
            }
        }
    }
    let tx = db.begin().await?;
    // Serialize replacements even when the requirements table is empty.
    tx.execute_unprepared("LOCK TABLE day_goal_requirement IN EXCLUSIVE MODE")
        .await?;
    requirement::Entity::delete_many().exec(&tx).await?;
    for row in &rows {
        row.clone().into_active_model().insert(&tx).await?;
    }
    tx.commit().await?;
    Ok(view(&rows))
}
pub async fn stats(db: &DatabaseConnection, zone: Tz) -> Result<Value> {
    let tx = db.begin().await?;
    tx.execute_unprepared("LOCK TABLE achieved_day IN EXCLUSIVE MODE")
        .await?;
    let requirements = requirement::Entity::find().all(&tx).await?;
    let mut values: BTreeMap<NaiveDate, [f64; 4]> = BTreeMap::new();
    let today = time::today(zone);
    values.insert(today, [0.; 4]);
    for p in pushup_set::Entity::find().all(&tx).await? {
        *values
            .entry(time::local(p.created_at, zone).date_naive())
            .or_default()
            .get_mut(0)
            .expect("metric") += f64::from(p.count);
    }
    for r in ride::Entity::find().all(&tx).await? {
        values
            .entry(time::local(r.created_at, zone).date_naive())
            .or_default()[1] += f64::from(r.total_elevation_gain.unwrap_or(0.));
    }
    for p in reading_progress::Entity::find().all(&tx).await? {
        if let Some(minutes) = p.minutes {
            values
                .entry(time::local(p.created_at, zone).date_naive())
                .or_default()[2] += f64::from(minutes);
        }
    }
    for t in daily_task_completion::Entity::find().all(&tx).await? {
        values.entry(t.date).or_default()[3] += 1.;
    }
    let mut achieved = achieved_day::Entity::find()
        .all(&tx)
        .await?
        .into_iter()
        .map(|a| (a.date, a))
        .collect::<BTreeMap<_, _>>();
    let configured = TIERS
        .iter()
        .map(|t| {
            requirements
                .iter()
                .filter(|r| r.tier == *t)
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();
    for (day, value) in &values {
        let reached = configured.iter().position(|rs| {
            !rs.is_empty()
                && rs.iter().all(|r| {
                    METRICS
                        .iter()
                        .position(|m| *m == r.metric)
                        .is_some_and(|i| value[i] >= f64::from(r.goal))
                })
        });
        if let Some(rank) = reached {
            let prior = achieved.get(day);
            if prior.is_none_or(|a| {
                TIERS
                    .iter()
                    .position(|t| *t == a.tier)
                    .is_some_and(|held| rank < held)
            }) {
                let a = achieved_day::Model {
                    date: *day,
                    tier: TIERS[rank].into(),
                    achieved_at: time::now(),
                    celebrated_at: None,
                };
                if prior.is_some() {
                    a.clone()
                        .into_active_model()
                        .reset_all()
                        .update(&tx)
                        .await?;
                } else {
                    a.clone().into_active_model().insert(&tx).await?;
                }
                achieved.insert(*day, a);
            }
        }
    }
    let held = achieved.get(&today);
    let rank = held
        .and_then(|a| TIERS.iter().position(|t| *t == a.tier))
        .unwrap_or(3);
    let next = (0..rank)
        .rev()
        .find(|i| !configured[*i].is_empty())
        .map(|i| TIERS[i]);
    let mut cursor = if held.is_some() {
        today
    } else {
        today.pred_opt().expect("date")
    };
    let mut streak = 0;
    while achieved.contains_key(&cursor) {
        streak += 1;
        cursor = cursor.pred_opt().expect("date");
    }
    let result = json!({"todayTier":held.map(|a|&a.tier),"nextTier":next,"celebrateToday":held.is_some_and(|a|a.celebrated_at.is_none()),"currentStreak":streak,
        "monthCounts":TIERS.iter().map(|tier|json!({"tier":tier,"count":achieved.values().filter(|a|a.tier==*tier && a.date.year()==today.year() && a.date.month()==today.month()).count()})).collect::<Vec<_>>(),
        "todayProgress":METRICS.iter().enumerate().map(|(i,metric)|json!({"metric":metric,"value":values[&today][i]})).collect::<Vec<_>>(),"tiers":view(&requirements).tiers});
    tx.commit().await?;
    Ok(result)
}
pub async fn celebrate(db: &DatabaseConnection, zone: Tz) -> Result<()> {
    achieved_day::Entity::update_many()
        .col_expr(
            achieved_day::Column::CelebratedAt,
            sea_orm::sea_query::Expr::value(time::now()),
        )
        .filter(achieved_day::Column::Date.eq(time::today(zone)))
        .filter(achieved_day::Column::CelebratedAt.is_null())
        .exec(db)
        .await?;
    Ok(())
}
pub async fn coins(db: &DatabaseConnection, reset: bool) -> Result<Value> {
    let mut s = settings::Entity::find_by_id(1)
        .one(db)
        .await?
        .ok_or_else(|| Error::Internal(anyhow::anyhow!("Settings row missing")))?;
    if reset {
        s.coins_reset_at = time::now();
        s.clone().into_active_model().reset_all().update(db).await?;
    }
    let count = achieved_day::Entity::find()
        .filter(achieved_day::Column::Tier.eq("GOLD"))
        .filter(achieved_day::Column::AchievedAt.gt(s.coins_reset_at))
        .all(db)
        .await?
        .len();
    Ok(json!({"totalCoins":count,"totalPoints":count*5,"pointsPerCoin":5}))
}
