use crate::{
    error::{Error, Result, name, require},
    models::{book, reading_progress as progress},
    time,
};
use chrono::{DateTime, FixedOffset};
use chrono_tz::Tz;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait,
    IntoActiveModel, QueryFilter, QueryOrder, QuerySelect, Set, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookInput {
    pub title: String,
    pub author: String,
    pub total_pages: Option<i32>,
    #[serde(default)]
    pub starting_page: i32,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressInput {
    pub current_page: i32,
    pub minutes: i32,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncInput {
    pub title: String,
    pub author: String,
    pub total_pages: i32,
    pub current_page: i32,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    id: Uuid,
    title: String,
    author: String,
    total_pages: Option<i32>,
    starting_page: i32,
    current_page: i32,
    created_at: DateTime<FixedOffset>,
    started_at: Option<DateTime<FixedOffset>>,
    completed_at: Option<DateTime<FixedOffset>>,
    average_pages_per_day: Option<f64>,
    estimated_days_remaining: Option<i32>,
}
fn summarize(b: book::Model, p: &[progress::Model], zone: Tz) -> Book {
    let current_page = p.last().map_or(b.starting_page, |v| v.current_page);
    let started = p.first().map(|p| p.created_at);
    let average = started
        .filter(|_| b.total_pages.is_some() && current_page > b.starting_page)
        .map(|s| {
            f64::from(current_page - b.starting_page)
                / ((time::now().date() - s.date()).num_days() + 1).max(1) as f64
        });
    Book {
        id: b.id,
        title: b.title,
        author: b.author,
        total_pages: b.total_pages,
        starting_page: b.starting_page,
        current_page,
        created_at: time::local(b.created_at, zone),
        started_at: started.map(|s| time::local(s, zone)),
        completed_at: b.completed_at.map(|s| time::local(s, zone)),
        average_pages_per_day: average,
        estimated_days_remaining: average
            .zip(b.total_pages)
            .map(|(avg, total)| (f64::from((total - current_page).max(0)) / avg).ceil() as i32),
    }
}
async fn history(db: &impl ConnectionTrait, id: Uuid) -> Result<Vec<progress::Model>> {
    Ok(progress::Entity::find()
        .filter(progress::Column::BookId.eq(id))
        .order_by_asc(progress::Column::CreatedAt)
        .all(db)
        .await?)
}
pub async fn list(db: &DatabaseConnection, zone: Tz) -> Result<Vec<Book>> {
    let books = book::Entity::find()
        .order_by_asc(book::Column::CreatedAt)
        .all(db)
        .await?;
    let progress = progress::Entity::find()
        .order_by_asc(progress::Column::CreatedAt)
        .all(db)
        .await?;
    let mut rows = books
        .into_iter()
        .map(|b| {
            let p = progress
                .iter()
                .filter(|p| p.book_id == b.id)
                .cloned()
                .collect::<Vec<_>>();
            (p.last().map(|p| p.created_at), summarize(b, &p, zone))
        })
        .collect::<Vec<_>>();
    rows.sort_by_key(|(date, _)| std::cmp::Reverse(*date));
    Ok(rows.into_iter().map(|(_, b)| b).collect())
}
pub async fn save(
    db: &DatabaseConnection,
    id: Option<Uuid>,
    input: BookInput,
    zone: Tz,
) -> Result<Book> {
    let title = name(&input.title)?;
    let author = name(&input.author)?;
    require(
        input.total_pages.is_none_or(|v| (1..=100000).contains(&v)),
        "Invalid totalPages",
    )?;
    require(
        input.total_pages.map_or(input.starting_page == 0, |v| {
            input.starting_page >= 0 && input.starting_page < v
        }),
        "Invalid startingPage",
    )?;
    let tx = db.begin().await?;
    let (mut b, p) = if let Some(id) = id {
        let b = book::Entity::find_by_id(id)
            .lock_exclusive()
            .one(&tx)
            .await?
            .ok_or(Error::NotFound)?;
        (b, history(&tx, id).await?)
    } else {
        (
            book::Model {
                id: Uuid::new_v4(),
                title: String::new(),
                author: String::new(),
                total_pages: None,
                starting_page: 0,
                created_at: time::now(),
                completed_at: None,
            },
            vec![],
        )
    };
    let current = p.last().map_or(input.starting_page, |v| v.current_page);
    require(
        current >= input.starting_page && input.total_pages.is_none_or(|v| current <= v),
        "Page counts conflict with recorded progress",
    )?;
    b.title = title;
    b.author = author;
    b.total_pages = input.total_pages;
    b.starting_page = input.starting_page;
    b.completed_at = if b.total_pages.is_some_and(|v| current >= v) {
        Some(b.completed_at.unwrap_or_else(time::now))
    } else {
        None
    };
    if id.is_some() {
        b.clone()
            .into_active_model()
            .reset_all()
            .update(&tx)
            .await?;
    } else {
        b.clone().into_active_model().insert(&tx).await?;
    }
    tx.commit().await?;
    Ok(summarize(b, &p, zone))
}
pub async fn record(
    db: &DatabaseConnection,
    id: Uuid,
    input: ProgressInput,
    zone: Tz,
) -> Result<Book> {
    let tx = db.begin().await?;
    let mut b = book::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&tx)
        .await?
        .ok_or(Error::NotFound)?;
    let mut p = history(&tx, id).await?;
    let latest = p.last().map_or(b.starting_page, |p| p.current_page);
    require(
        b.total_pages.is_some_and(|v| input.current_page <= v)
            && input.current_page > latest
            && (1..=1440).contains(&input.minutes),
        "Progress requires new pages and 1–1440 minutes",
    )?;
    let now = time::now();
    p.push(
        progress::ActiveModel {
            id: Set(Uuid::new_v4()),
            book_id: Set(id),
            current_page: Set(input.current_page),
            minutes: Set(Some(input.minutes)),
            created_at: Set(now),
        }
        .insert(&tx)
        .await?,
    );
    b.completed_at = if b.total_pages == Some(input.current_page) {
        Some(b.completed_at.unwrap_or(now))
    } else {
        None
    };
    b.clone()
        .into_active_model()
        .reset_all()
        .update(&tx)
        .await?;
    tx.commit().await?;
    Ok(summarize(b, &p, zone))
}
pub async fn remove(db: &DatabaseConnection, id: Uuid) -> Result<()> {
    let tx = db.begin().await?;
    book::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&tx)
        .await?
        .ok_or(Error::NotFound)?;
    progress::Entity::delete_many()
        .filter(progress::Column::BookId.eq(id))
        .exec(&tx)
        .await?;
    book::Entity::delete_by_id(id).exec(&tx).await?;
    tx.commit().await?;
    Ok(())
}
pub async fn sync(db: &DatabaseConnection, input: SyncInput) -> Result<()> {
    use sea_orm::sea_query::ExprTrait;
    let title = name(&input.title)?;
    let author = name(&input.author)?;
    require(
        (1..=100000).contains(&input.total_pages)
            && (0..=input.total_pages).contains(&input.current_page),
        "Invalid page count",
    )?;
    let tx = db.begin().await?;
    let existing = book::Entity::find()
        .filter(
            sea_orm::sea_query::Expr::expr(sea_orm::sea_query::Func::lower(
                sea_orm::sea_query::Expr::col(book::Column::Title),
            ))
            .eq(title.to_lowercase()),
        )
        .filter(
            sea_orm::sea_query::Expr::expr(sea_orm::sea_query::Func::lower(
                sea_orm::sea_query::Expr::col(book::Column::Author),
            ))
            .eq(author.to_lowercase()),
        )
        .order_by_asc(book::Column::CreatedAt)
        .lock_exclusive()
        .one(&tx)
        .await?;
    let mut b = match existing {
        Some(b) => b,
        None => {
            book::ActiveModel {
                id: Set(Uuid::new_v4()),
                title: Set(title),
                author: Set(author),
                total_pages: Set(Some(input.total_pages)),
                starting_page: Set(0),
                created_at: Set(time::now()),
                completed_at: Set(None),
            }
            .insert(&tx)
            .await?
        }
    };
    let p = history(&tx, b.id).await?;
    let latest = p.last().map_or(b.starting_page, |p| p.current_page);
    if latest != input.current_page {
        progress::ActiveModel {
            id: Set(Uuid::new_v4()),
            book_id: Set(b.id),
            current_page: Set(input.current_page),
            minutes: Set(None),
            created_at: Set(time::now()),
        }
        .insert(&tx)
        .await?;
    }
    b.total_pages = Some(input.total_pages);
    b.completed_at = if input.current_page == input.total_pages {
        Some(b.completed_at.unwrap_or_else(time::now))
    } else {
        None
    };
    b.into_active_model().reset_all().update(&tx).await?;
    tx.commit().await?;
    Ok(())
}
