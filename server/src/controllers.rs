use crate::json::Json;
use crate::{
    crypto::Cipher,
    error::{Error, Result},
    middleware::Claims,
    services::{
        devices, goals,
        integrations::{Callback, Integrations},
        measurements, reading, tasks,
    },
    settings::Settings,
    time,
};
use axum::{
    Extension,
    extract::{Multipart, Path, Query, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Redirect, Response},
};
use loco_rs::{app::AppContext, controller::Routes};
use serde_json::{Value, json};
use uuid::Uuid;

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api")
        .get("/environment", environment)
        .get("/reading/books", books)
        .post("/reading/books", add_book)
        .put("/reading/books/{id}", edit_book)
        .delete("/reading/books/{id}", delete_book)
        .post("/reading/books/{id}/progress", progress)
        .post("/reading/koreader-sync", koreader)
        .get("/tasks", list_tasks)
        .post("/tasks", add_task)
        .put("/tasks/{id}", edit_task)
        .delete("/tasks/{id}", delete_task)
        .get("/tasks/today", today_tasks)
        .put("/tasks/{id}/completion", completion)
        .get("/settings", get_settings)
        .put("/settings", put_settings)
        .get("/day-goal", day_goal)
        .post("/day-goal/celebrate", celebrate)
        .get("/coins", coins)
        .post("/coins/reset", reset_coins)
        .get("/devices", list_devices)
        .post("/devices", add_device)
        .delete("/devices/{id}", delete_device)
        .post("/devices/{id}/books", upload)
        .delete("/devices/{id}/books/{book}", remove_upload)
        .get("/device/books", device_books)
        .get("/device/books/{id}/file", download)
        .delete("/device/books/{id}", acknowledge)
        .get("/pushups", pushups)
        .post("/pushups", add_pushup)
        .get("/weight", weight)
        .get("/fitness", fitness)
        .get("/ftp", ftp)
        .get("/ride/stats", ride)
        .get("/ride/podium", podium)
        .post("/strava/activities/sync", sync_strava)
        .post("/withings/sync", sync_withings)
        .get("/{provider}/authorize", authorize)
}
async fn environment(State(ctx): State<AppContext>) -> Result<Json<Value>> {
    let s: Settings = ctx.config.settings().map_err(anyhow::Error::from)?;
    Ok(Json(json!({"thunderforestApiKey":s.thunderforest_api_key})))
}
async fn books(State(c): State<AppContext>, h: HeaderMap) -> Result<Json<Vec<reading::Book>>> {
    Ok(Json(reading::list(&c.db, time::zone(&h)?).await?))
}
async fn add_book(
    State(c): State<AppContext>,
    h: HeaderMap,
    Json(b): Json<reading::BookInput>,
) -> Result<Json<reading::Book>> {
    Ok(Json(reading::save(&c.db, None, b, time::zone(&h)?).await?))
}
async fn edit_book(
    State(c): State<AppContext>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(b): Json<reading::BookInput>,
) -> Result<Json<reading::Book>> {
    Ok(Json(
        reading::save(&c.db, Some(id), b, time::zone(&h)?).await?,
    ))
}
async fn delete_book(State(c): State<AppContext>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    reading::remove(&c.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn progress(
    State(c): State<AppContext>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(b): Json<reading::ProgressInput>,
) -> Result<Json<reading::Book>> {
    Ok(Json(reading::record(&c.db, id, b, time::zone(&h)?).await?))
}
async fn koreader(
    State(c): State<AppContext>,
    Extension(cipher): Extension<Cipher>,
    h: HeaderMap,
    Json(b): Json<reading::SyncInput>,
) -> Result<StatusCode> {
    devices::authenticate(&c.db, &cipher, &h).await?;
    reading::sync(&c.db, b).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn list_tasks(State(c): State<AppContext>) -> Result<Json<Vec<tasks::Task>>> {
    Ok(Json(tasks::list(&c.db, None).await?))
}
async fn today_tasks(State(c): State<AppContext>, h: HeaderMap) -> Result<Json<Vec<tasks::Task>>> {
    Ok(Json(
        tasks::list(&c.db, Some(time::today(time::zone(&h)?))).await?,
    ))
}
async fn add_task(
    State(c): State<AppContext>,
    Json(b): Json<tasks::TaskInput>,
) -> Result<Response> {
    let task = tasks::save(&c.db, None, b).await?;
    Ok((
        StatusCode::CREATED,
        [(header::LOCATION, format!("/tasks/{}", task.id))],
        Json(task),
    )
        .into_response())
}
async fn edit_task(
    State(c): State<AppContext>,
    Path(id): Path<Uuid>,
    Json(b): Json<tasks::TaskInput>,
) -> Result<Json<tasks::Task>> {
    Ok(Json(tasks::save(&c.db, Some(id), b).await?))
}
async fn delete_task(State(c): State<AppContext>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    tasks::remove(&c.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn completion(
    State(c): State<AppContext>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(b): Json<tasks::CompletionInput>,
) -> Result<StatusCode> {
    tasks::complete(&c.db, id, time::today(time::zone(&h)?), b.completed).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn get_settings(State(c): State<AppContext>) -> Result<Json<goals::Settings>> {
    Ok(Json(goals::get(&c.db).await?))
}
async fn put_settings(
    State(c): State<AppContext>,
    Json(b): Json<goals::Settings>,
) -> Result<Json<goals::Settings>> {
    Ok(Json(goals::update(&c.db, b).await?))
}
async fn day_goal(State(c): State<AppContext>, h: HeaderMap) -> Result<Json<Value>> {
    Ok(Json(goals::stats(&c.db, time::zone(&h)?).await?))
}
async fn celebrate(State(c): State<AppContext>, h: HeaderMap) -> Result<StatusCode> {
    goals::celebrate(&c.db, time::zone(&h)?).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn coins(State(c): State<AppContext>) -> Result<Json<Value>> {
    Ok(Json(goals::coins(&c.db, false).await?))
}
async fn reset_coins(State(c): State<AppContext>) -> Result<Json<Value>> {
    Ok(Json(goals::coins(&c.db, true).await?))
}
async fn list_devices(State(c): State<AppContext>, h: HeaderMap) -> Result<Json<Vec<Value>>> {
    Ok(Json(devices::list(&c.db, time::zone(&h)?).await?))
}
async fn add_device(
    State(c): State<AppContext>,
    Extension(cipher): Extension<Cipher>,
    h: HeaderMap,
    Json(b): Json<devices::DeviceInput>,
) -> Result<Json<Value>> {
    Ok(Json(
        devices::create(&c.db, &cipher, b, time::zone(&h)?).await?,
    ))
}
async fn delete_device(State(c): State<AppContext>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    devices::remove(&c.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn upload(
    State(c): State<AppContext>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<Value>> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| Error::BadRequest(e.to_string()))?
    {
        if field.name() != Some("file") {
            continue;
        }
        let name = field
            .file_name()
            .ok_or_else(|| Error::BadRequest("Missing filename".into()))?
            .to_owned();
        let content_type = field
            .content_type()
            .unwrap_or("application/octet-stream")
            .to_owned();
        let bytes = field
            .bytes()
            .await
            .map_err(|e| Error::BadRequest(e.to_string()))?;
        return Ok(Json(
            devices::upload(
                &c.db,
                id,
                name,
                content_type,
                bytes.to_vec(),
                time::zone(&h)?,
            )
            .await?,
        ));
    }
    Err(Error::BadRequest("Missing file".into()))
}
async fn remove_upload(
    State(c): State<AppContext>,
    Path((id, book)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    devices::remove_book(&c.db, id, book).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn device_books(
    State(c): State<AppContext>,
    Extension(cipher): Extension<Cipher>,
    h: HeaderMap,
) -> Result<Json<Vec<Value>>> {
    let id = devices::authenticate(&c.db, &cipher, &h).await?;
    Ok(Json(devices::books(&c.db, id, chrono_tz::UTC).await?))
}
async fn download(
    State(c): State<AppContext>,
    Extension(cipher): Extension<Cipher>,
    Path(book): Path<Uuid>,
    h: HeaderMap,
) -> Result<Response> {
    let id = devices::authenticate(&c.db, &cipher, &h).await?;
    let b = devices::file(&c.db, id, book).await?;
    const FILENAME_ENCODE_SET: &percent_encoding::AsciiSet = &percent_encoding::NON_ALPHANUMERIC
        .remove(b'-')
        .remove(b'.')
        .remove(b'_')
        .remove(b'~');
    let filename = percent_encoding::utf8_percent_encode(&b.file_name, FILENAME_ENCODE_SET);
    Ok((
        [
            (header::CONTENT_TYPE, b.content_type),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename*=UTF-8''{filename}"),
            ),
        ],
        b.data,
    )
        .into_response())
}
async fn acknowledge(
    State(c): State<AppContext>,
    Extension(cipher): Extension<Cipher>,
    Path(book): Path<Uuid>,
    h: HeaderMap,
) -> Result<StatusCode> {
    let id = devices::authenticate(&c.db, &cipher, &h).await?;
    devices::remove_book(&c.db, id, book).await?;
    Ok(StatusCode::NO_CONTENT)
}
macro_rules! measurement {
    ($name:ident,$kind:literal) => {
        async fn $name(
            State(c): State<AppContext>,
            Query(p): Query<measurements::Period>,
            h: HeaderMap,
        ) -> Result<Json<Value>> {
            Ok(Json(
                measurements::list(&c.db, $kind, p.period, time::zone(&h)?).await?,
            ))
        }
    };
}
measurement!(pushups, "pushups");
measurement!(weight, "weight");
measurement!(fitness, "fitness");
measurement!(ftp, "ftp");
measurement!(ride, "ride");
async fn add_pushup(
    State(c): State<AppContext>,
    h: HeaderMap,
    Json(b): Json<measurements::Pushup>,
) -> Result<Json<Value>> {
    Ok(Json(
        measurements::add_pushup(&c.db, b, time::zone(&h)?).await?,
    ))
}
async fn podium(State(c): State<AppContext>, h: HeaderMap) -> Result<Response> {
    let s: Settings = c.config.settings().map_err(anyhow::Error::from)?;
    Ok(
        match measurements::podium(&c.db, time::zone(&h)?, &s.strava.api_url).await? {
            Some(v) => Json(v).into_response(),
            None => StatusCode::NO_CONTENT.into_response(),
        },
    )
}
fn base(h: &HeaderMap) -> Result<String> {
    let host = h
        .get("X-Forwarded-Host")
        .or_else(|| h.get(header::HOST))
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| Error::BadRequest("Missing host".into()))?;
    let scheme = h
        .get("X-Forwarded-Proto")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("http");
    let base = format!("{scheme}://{host}");
    crate::middleware::validate_endpoint(&base)?;
    Ok(base)
}
async fn sync(
    c: AppContext,
    i: Integrations,
    claims: Claims,
    h: HeaderMap,
    provider: &str,
) -> Result<Response> {
    match i.sync(&c.db,provider,&claims.oid,time::zone(&h)?).await{
        Ok(())=>Ok(StatusCode::OK.into_response()),
        Err(Error::Reauthorize)=>Ok((StatusCode::UNAUTHORIZED,Json(json!({"_links":{"oauth2Login":{"href":i.login(provider,&claims.oid,&base(&h)?).await?}}}))).into_response()),
        Err(e)=>Err(e)
    }
}
async fn sync_strava(
    State(c): State<AppContext>,
    Extension(i): Extension<Integrations>,
    Extension(claims): Extension<Claims>,
    h: HeaderMap,
) -> Result<Response> {
    sync(c, i, claims, h, "strava").await
}
async fn sync_withings(
    State(c): State<AppContext>,
    Extension(i): Extension<Integrations>,
    Extension(claims): Extension<Claims>,
    h: HeaderMap,
) -> Result<Response> {
    sync(c, i, claims, h, "withings").await
}
async fn authorize(
    State(c): State<AppContext>,
    Extension(i): Extension<Integrations>,
    Path(provider): Path<String>,
    Query(input): Query<Callback>,
    h: HeaderMap,
) -> Result<Redirect> {
    Ok(Redirect::to(
        &i.authorize(&c.db, &provider, input, &base(&h)?).await?,
    ))
}
