use crate::{
    error::{Error, Result, name},
    models::{daily_task as task, daily_task_completion as completion},
    time,
};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, IntoActiveModel, QueryFilter,
    QueryOrder, QuerySelect, Set, TransactionTrait, sea_query::OnConflict,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct TaskInput {
    pub name: String,
}
#[derive(Deserialize)]
pub struct CompletionInput {
    pub completed: bool,
}
#[derive(Serialize)]
pub struct Task {
    pub id: Uuid,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed: Option<bool>,
}
pub async fn list(db: &DatabaseConnection, today: Option<chrono::NaiveDate>) -> Result<Vec<Task>> {
    let completed = match today {
        Some(date) => {
            completion::Entity::find()
                .filter(completion::Column::Date.eq(date))
                .all(db)
                .await?
        }
        None => vec![],
    };
    Ok(task::Entity::find()
        .order_by_asc(task::Column::CreatedAt)
        .all(db)
        .await?
        .into_iter()
        .map(|t| Task {
            id: t.id,
            name: t.name,
            completed: today.map(|_| completed.iter().any(|c| c.task_id == t.id)),
        })
        .collect())
}
pub async fn save(db: &DatabaseConnection, id: Option<Uuid>, input: TaskInput) -> Result<Task> {
    let name = name(&input.name)?;
    let t = if let Some(id) = id {
        let mut t = task::Entity::find_by_id(id)
            .one(db)
            .await?
            .ok_or(Error::NotFound)?
            .into_active_model();
        t.name = Set(name);
        t.update(db).await?
    } else {
        task::ActiveModel {
            id: Set(Uuid::new_v4()),
            name: Set(name),
            created_at: Set(time::now()),
        }
        .insert(db)
        .await?
    };
    Ok(Task {
        id: t.id,
        name: t.name,
        completed: None,
    })
}
pub async fn remove(db: &DatabaseConnection, id: Uuid) -> Result<()> {
    let tx = db.begin().await?;
    task::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&tx)
        .await?
        .ok_or(Error::NotFound)?;
    completion::Entity::delete_many()
        .filter(completion::Column::TaskId.eq(id))
        .exec(&tx)
        .await?;
    task::Entity::delete_by_id(id).exec(&tx).await?;
    tx.commit().await?;
    Ok(())
}
pub async fn complete(
    db: &DatabaseConnection,
    id: Uuid,
    date: chrono::NaiveDate,
    completed: bool,
) -> Result<()> {
    let tx = db.begin().await?;
    task::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&tx)
        .await?
        .ok_or(Error::NotFound)?;
    if completed {
        completion::Entity::insert(completion::ActiveModel {
            id: Set(Uuid::new_v4()),
            task_id: Set(id),
            date: Set(date),
            completed_at: Set(time::now()),
        })
        .on_conflict(
            OnConflict::columns([completion::Column::TaskId, completion::Column::Date])
                .do_nothing()
                .to_owned(),
        )
        .try_insert()
        .exec(&tx)
        .await?;
    } else {
        completion::Entity::delete_many()
            .filter(completion::Column::TaskId.eq(id))
            .filter(completion::Column::Date.eq(date))
            .exec(&tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}
