use crate::{
    error::{Result, require},
    models::{fitness, ftp, pushup_set, ride, segment, segment_effort, weight},
    time,
};
use chrono::{NaiveDate, NaiveDateTime};
use chrono_tz::Tz;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait,
    IntoActiveModel, QueryFilter, QueryOrder, Set, TransactionTrait,
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::BTreeMap;
#[derive(Deserialize)]
pub struct Period {
    pub period: Option<u32>,
}
#[derive(Deserialize)]
pub struct Pushup {
    pub count: i32,
}
pub async fn add_pushup(db: &DatabaseConnection, input: Pushup, zone: Tz) -> Result<Value> {
    require(
        (-500..=500).contains(&input.count),
        "count must be between -500 and 500",
    )?;
    let p = pushup_set::ActiveModel {
        created_at: Set(time::now()),
        count: Set(input.count),
    }
    .insert(db)
    .await?;
    Ok(json!({"createdAt":time::local(p.created_at,zone),"count":p.count}))
}
fn in_range(at: NaiveDateTime, range: (Option<NaiveDateTime>, NaiveDateTime)) -> bool {
    at < range.1 && range.0.is_none_or(|start| at >= start)
}
pub async fn list(
    db: &DatabaseConnection,
    kind: &str,
    period: Option<u32>,
    zone: Tz,
) -> Result<Value> {
    let range = time::range(period, zone)?;
    Ok(match kind {
        "pushups" => json!(
            pushup_set::Entity::find()
                .order_by_asc(pushup_set::Column::CreatedAt)
                .all(db)
                .await?
                .iter()
                .filter(|p| in_range(p.created_at, range))
                .map(|p| json!({"createdAt":time::local(p.created_at,zone),"count":p.count}))
                .collect::<Vec<_>>()
        ),
        "weight" => {
            let rows = weight::Entity::find()
                .order_by_asc(weight::Column::CreatedAt)
                .all(db)
                .await?;
            let view = |p: &weight::Model| json!({"date":time::local(p.created_at,zone),"weight":p.weight,"fatRatio":p.fat_ratio,"fatMassWeight":p.fat_mass_weight});
            json!({"measurements":rows.iter().filter(|p|in_range(p.created_at,range)).map(view).collect::<Vec<_>>(),"baseline":range.0.and_then(|start|rows.iter().rev().find(|p|p.created_at<start)).map(view)})
        }
        "fitness" => {
            json!({"measurements":fitness::Entity::find().order_by_asc(fitness::Column::CreatedAt).all(db).await?.iter().filter(|p|in_range(p.created_at,range)).map(|p|json!({"date":time::local(p.created_at,zone),"fitness":p.fitness,"fatigue":p.fatigue,"form":p.form})).collect::<Vec<_>>()})
        }
        "ftp" => {
            json!({"measurements":ftp::Entity::find().order_by_asc(ftp::Column::CreatedAt).all(db).await?.iter().filter(|p|in_range(p.created_at,range)).map(|p|json!({"date":time::local(p.created_at,zone),"ftp":p.ftp,"weight":p.weight,"ftpPerKg":p.ftp_per_kg})).collect::<Vec<_>>()})
        }
        "ride" => {
            let sum = ride::Entity::find()
                .all(db)
                .await?
                .iter()
                .filter(|p| in_range(p.created_at, range))
                .fold([0.; 4], |sum, r| {
                    [
                        sum[0] + f64::from(r.calories.unwrap_or(0.)),
                        sum[1] + f64::from(r.distance.unwrap_or(0.)),
                        sum[2] + f64::from(r.total_elevation_gain.unwrap_or(0.)),
                        sum[3] + f64::from(r.moving_time.unwrap_or(0)),
                    ]
                });
            json!({"calories":sum[0],"distance":sum[1],"elevationGain":sum[2],"time":sum[3]})
        }
        _ => return Err(crate::error::Error::NotFound),
    })
}
pub async fn recompute(db: &DatabaseConnection, zone: Tz) -> Result<()> {
    let tx = db.begin().await?;
    tx.execute_unprepared("LOCK TABLE fitness, ftp IN EXCLUSIVE MODE")
        .await?;
    let rides = ride::Entity::find()
        .order_by_asc(ride::Column::CreatedAt)
        .all(&tx)
        .await?;
    let mut loads: BTreeMap<NaiveDate, f64> = BTreeMap::new();
    let mut powers: BTreeMap<NaiveDate, f64> = BTreeMap::new();
    for r in rides {
        let day = time::local(r.created_at, zone).date_naive();
        if let Some(load) = r.suffer_score {
            *loads.entry(day).or_default() += f64::from(load);
        }
        if let (Some(seconds), Some(watts)) = (r.moving_time, r.weighted_average_watts)
            && seconds >= 1200
            && watts > 0.
        {
            let power = f64::from(watts) * (f64::from(seconds) / 3600.).powf(0.07);
            powers
                .entry(day)
                .and_modify(|p| *p = p.max(power))
                .or_insert(power);
        }
    }
    let today = time::today(zone);
    let first = loads.keys().next().copied().unwrap_or(today);
    let last = today.max(first);
    let persisted = fitness::Entity::find()
        .all(&tx)
        .await?
        .into_iter()
        .map(|f| (f.created_at, f))
        .collect::<BTreeMap<_, _>>();
    let mut intended = BTreeMap::new();
    let mut day = first;
    let mut fit = 0.;
    let mut fat = 0.;
    let lf = (-1f64 / 42.).exp();
    let la = (-1f64 / 7.).exp();
    while day <= last {
        let load = loads.get(&day).copied().unwrap_or(0.);
        fit = lf * fit + (1. - lf) * load;
        fat = la * fat + (1. - la) * load;
        let at = time::start(day, zone)?;
        let model = fitness::Model {
            created_at: at,
            fitness: Some(fit as f32),
            fatigue: Some(fat as f32),
            form: Some((fit - fat) as f32),
            pulled_at: Some(time::now()),
        };
        let changed = persisted.get(&at).is_none_or(|p| {
            diff(p.fitness, model.fitness)
                || diff(p.fatigue, model.fatigue)
                || diff(p.form, model.form)
        });
        if changed {
            if persisted.contains_key(&at) {
                model
                    .clone()
                    .into_active_model()
                    .reset_all()
                    .update(&tx)
                    .await?;
            } else {
                model.clone().into_active_model().insert(&tx).await?;
            }
        }
        intended.insert(at, model);
        day = day.succ_opt().expect("date");
    }
    for at in persisted.keys().filter(|at| !intended.contains_key(at)) {
        fitness::Entity::delete_by_id(*at).exec(&tx).await?;
    }
    let mut weights = BTreeMap::new();
    for w in weight::Entity::find()
        .order_by_asc(weight::Column::CreatedAt)
        .all(&tx)
        .await?
    {
        weights.insert(time::local(w.created_at, zone).date_naive(), w.weight);
    }
    let persisted = ftp::Entity::find()
        .all(&tx)
        .await?
        .into_iter()
        .map(|f| (f.created_at, f))
        .collect::<BTreeMap<_, _>>();
    let mut intended = BTreeMap::new();
    for (day, power) in powers {
        if let Some((_, Some(weight))) = weights.range(..=day).next_back() {
            if *weight <= 0. {
                continue;
            }
            let at = time::start(day, zone)?;
            let model = ftp::Model {
                created_at: at,
                ftp: power as f32,
                weight: *weight,
                ftp_per_kg: (power / f64::from(*weight)) as f32,
                pulled_at: time::now(),
            };
            let changed = persisted.get(&at).is_none_or(|p| {
                (p.ftp - model.ftp).abs() >= 1e-3
                    || (p.weight - model.weight).abs() >= 1e-3
                    || (p.ftp_per_kg - model.ftp_per_kg).abs() >= 1e-3
            });
            if changed {
                if persisted.contains_key(&at) {
                    model
                        .clone()
                        .into_active_model()
                        .reset_all()
                        .update(&tx)
                        .await?;
                } else {
                    model.clone().into_active_model().insert(&tx).await?;
                }
            }
            intended.insert(at, model);
        }
    }
    for at in persisted.keys().filter(|at| !intended.contains_key(at)) {
        ftp::Entity::delete_by_id(*at).exec(&tx).await?;
    }
    tx.commit().await?;
    Ok(())
}
fn diff(a: Option<f32>, b: Option<f32>) -> bool {
    match (a, b) {
        (Some(a), Some(b)) => (a - b).abs() >= 1e-3,
        _ => a != b,
    }
}
pub async fn podium(db: &DatabaseConnection, zone: Tz, api_url: &str) -> Result<Option<Value>> {
    let today = time::today(zone);
    let start = time::start(today, zone)?;
    let end = time::start(today.succ_opt().expect("date"), zone)?;
    let all = segment_effort::Entity::find()
        .order_by_asc(segment_effort::Column::ElapsedTime)
        .all(db)
        .await?;
    let mut best: Option<(
        f64,
        &segment_effort::Model,
        usize,
        usize,
        Vec<&segment_effort::Model>,
    )> = None;
    for effort in all
        .iter()
        .filter(|e| e.start_date >= start && e.start_date <= end)
    {
        for (period, days) in [Some(6), Some(29), None].iter().enumerate() {
            let after = days
                .map(|d| time::start(today - chrono::Duration::days(d), zone))
                .transpose()?;
            let ranked = all
                .iter()
                .filter(|e| {
                    e.segment_id == effort.segment_id
                        && after.is_none_or(|after| e.start_date >= after)
                })
                .collect::<Vec<_>>();
            if ranked.len() < 3 {
                continue;
            }
            let position = ranked
                .iter()
                .position(|e| e.id == effort.id)
                .expect("effort in ranking")
                + 1;
            if position > 3 {
                continue;
            }
            let score = (4 - position) as f64
                * (period + 1) as f64
                * f64::from(
                    effort.segment_distance.max(1.) * effort.segment_average_grade.max(0.1),
                );
            if best.as_ref().is_none_or(|b| score > b.0) {
                best = Some((score, effort, period, position, ranked));
            }
        }
    }
    let Some((_, e, period, position, ranked)) = best else {
        return Ok(None);
    };
    let faster = position.checked_sub(2).and_then(|i| ranked.get(i));
    let slower = ranked.get(position);
    let weight = weight::Entity::find()
        .filter(weight::Column::CreatedAt.lt(e.start_date + chrono::Duration::days(1)))
        .order_by_desc(weight::Column::CreatedAt)
        .one(db)
        .await?
        .and_then(|w| w.weight)
        .filter(|w| *w > 0.);
    let segment = segment::Entity::find_by_id(e.segment_id).one(db).await?;
    Ok(Some(
        json!({"segmentName":e.segment_name,"segmentUrl":format!("{api_url}/segments/{}",e.segment_id),"period":(["WEEK","MONTH","ALL_TIME"][period]),"position":position,
        "message":format!("{} place {} on {}",["1st","2nd","3rd"][position-1],["this week","this month","all-time"][period],e.segment_name),
        "distance":e.segment_distance,"elapsedTime":e.elapsed_time,"averageGrade":e.segment_average_grade,"elevationGain":e.segment_distance*e.segment_average_grade/100.,"averageWatts":e.average_watts,"averageWattsPerKg":e.average_watts.zip(weight).map(|(p,w)|p/w),
        "fasterPosition":faster.map(|_|position-1),"gapToFaster":faster.map(|f|e.elapsed_time-f.elapsed_time),"fasterStartDate":faster.map(|f|time::local(f.start_date,chrono_tz::UTC)),
        "slowerPosition":slower.map(|_|position+1),"gapToSlower":slower.map(|s|s.elapsed_time-e.elapsed_time),"slowerStartDate":slower.map(|s|time::local(s.start_date,chrono_tz::UTC)),
        "latitudes":segment.as_ref().map(|s|&s.latitudes),"longitudes":segment.as_ref().map(|s|&s.longitudes),"distances":segment.as_ref().map(|s|&s.distances),"altitudes":segment.as_ref().map(|s|&s.altitudes)}),
    ))
}
