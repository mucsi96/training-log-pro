use crate::{
    crypto::Cipher,
    error::{Error, Result, name, require},
    models::{device, device_book},
    time,
};
use chrono_tz::Tz;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, Set, TransactionTrait,
};
use serde::Deserialize;
use serde_json::{Value, json};
use subtle::ConstantTimeEq;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct DeviceInput {
    pub name: String,
}
#[derive(sea_orm::FromQueryResult)]
struct PendingBook {
    id: Uuid,
    file_name: String,
    created_at: chrono::NaiveDateTime,
}
pub async fn books(db: &DatabaseConnection, id: Uuid, zone: Tz) -> Result<Vec<Value>> {
    Ok(device_book::Entity::find()
        .select_only()
        .columns([device_book::Column::Id, device_book::Column::FileName, device_book::Column::CreatedAt])
        .filter(device_book::Column::DeviceId.eq(id))
        .order_by_asc(device_book::Column::CreatedAt)
        .into_model::<PendingBook>()
        .all(db)
        .await?
        .iter()
        .map(|b| json!({"id":b.id,"fileName":b.file_name,"createdAt":time::local(b.created_at,zone)}))
        .collect())
}
fn summary(b: &device_book::Model, zone: Tz) -> Value {
    json!({"id":b.id,"fileName":b.file_name,"createdAt":time::local(b.created_at,zone)})
}
pub async fn list(db: &DatabaseConnection, zone: Tz) -> Result<Vec<Value>> {
    let mut result = vec![];
    for d in device::Entity::find()
        .order_by_asc(device::Column::CreatedAt)
        .all(db)
        .await?
    {
        result.push(json!({"id":d.id,"name":d.name,"createdAt":time::local(d.created_at,zone),"books":books(db,d.id,zone).await?}));
    }
    Ok(result)
}
pub async fn create(
    db: &DatabaseConnection,
    cipher: &Cipher,
    input: DeviceInput,
    zone: Tz,
) -> Result<Value> {
    use aes_gcm::aead::{OsRng, rand_core::RngCore};
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    let mut bytes = [0u8; 48];
    OsRng.fill_bytes(&mut bytes);
    let key = URL_SAFE_NO_PAD.encode(bytes);
    let d = device::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(name(&input.name)?),
        encrypted_key: Set(cipher.encrypt(&key)?),
        created_at: Set(time::now()),
    }
    .insert(db)
    .await?;
    Ok(json!({"id":d.id,"name":d.name,"apiKey":key,"createdAt":time::local(d.created_at,zone)}))
}
pub async fn authenticate(
    db: &DatabaseConnection,
    cipher: &Cipher,
    headers: &axum::http::HeaderMap,
) -> Result<Uuid> {
    let key = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(Error::Unauthorized)?;
    for d in device::Entity::find().all(db).await? {
        let stored = cipher.decrypt(&d.encrypted_key)?;
        if bool::from(key.as_bytes().ct_eq(stored.as_bytes())) {
            return Ok(d.id);
        }
    }
    Err(Error::Unauthorized)
}
pub async fn remove(db: &DatabaseConnection, id: Uuid) -> Result<()> {
    let tx = db.begin().await?;
    device::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&tx)
        .await?
        .ok_or(Error::NotFound)?;
    device_book::Entity::delete_many()
        .filter(device_book::Column::DeviceId.eq(id))
        .exec(&tx)
        .await?;
    device::Entity::delete_by_id(id).exec(&tx).await?;
    tx.commit().await?;
    Ok(())
}
pub async fn upload(
    db: &DatabaseConnection,
    id: Uuid,
    file: String,
    content_type: String,
    data: Vec<u8>,
    zone: Tz,
) -> Result<Value> {
    require(!data.is_empty(), "Missing file")?;
    let file = name(&file)?;
    device::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or(Error::NotFound)?;
    let b = device_book::ActiveModel {
        id: Set(Uuid::new_v4()),
        device_id: Set(id),
        file_name: Set(file),
        content_type: Set(content_type),
        data: Set(data),
        created_at: Set(time::now()),
    }
    .insert(db)
    .await?;
    Ok(summary(&b, zone))
}
pub async fn file(db: &DatabaseConnection, id: Uuid, book: Uuid) -> Result<device_book::Model> {
    device_book::Entity::find_by_id(book)
        .filter(device_book::Column::DeviceId.eq(id))
        .one(db)
        .await?
        .ok_or(Error::NotFound)
}
pub async fn remove_book(db: &DatabaseConnection, id: Uuid, book: Uuid) -> Result<()> {
    let result = device_book::Entity::delete_many()
        .filter(device_book::Column::Id.eq(book))
        .filter(device_book::Column::DeviceId.eq(id))
        .exec(db)
        .await?;
    if result.rows_affected == 0 {
        Err(Error::NotFound)
    } else {
        Ok(())
    }
}
