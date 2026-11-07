use crate::{
    crypto::Cipher,
    error::{Error, Result},
    models::{oauth2_authorized_client as oauth, ride, segment, segment_effort, weight},
    settings::{Provider, Settings},
    time,
};
use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, IntoActiveModel, QueryFilter,
    Set, TransactionTrait, sea_query::OnConflict,
};
use serde::Deserialize;
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone)]
pub struct Integrations(Arc<Inner>);
struct Inner {
    settings: Settings,
    cipher: Cipher,
    http: reqwest::Client,
    tokens: Mutex<HashMap<String, Ticket>>,
    sync: Mutex<()>,
}
struct Ticket {
    principal: String,
    provider: String,
    expires: Instant,
    state: Option<String>,
    redirect: Option<String>,
}
#[derive(Deserialize)]
pub struct Callback {
    pub token: String,
    pub code: Option<String>,
    pub state: Option<String>,
}
#[derive(Deserialize)]
struct Token {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: i64,
    scope: Option<String>,
}
#[derive(Deserialize)]
struct Envelope<T> {
    status: i32,
    body: Option<T>,
}
impl Integrations {
    pub fn new(settings: Settings, cipher: Cipher) -> anyhow::Result<Self> {
        Ok(Self(Arc::new(Inner {
            settings,
            cipher,
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .redirect(reqwest::redirect::Policy::none())
                .build()?,
            tokens: Mutex::new(HashMap::new()),
            sync: Mutex::new(()),
        })))
    }
    fn provider(&self, provider: &str) -> Result<&Provider> {
        match provider {
            "strava" => Ok(&self.0.settings.strava),
            "withings" => Ok(&self.0.settings.withings),
            _ => Err(Error::NotFound),
        }
    }
    pub async fn login(&self, provider: &str, principal: &str, base: &str) -> Result<String> {
        self.provider(provider)?;
        let token = Uuid::new_v4().to_string();
        let mut tickets = self.0.tokens.lock().await;
        tickets.retain(|_, t| t.expires > Instant::now());
        tickets.insert(
            token.clone(),
            Ticket {
                principal: principal.into(),
                provider: provider.into(),
                expires: Instant::now() + Duration::from_secs(60),
                state: None,
                redirect: None,
            },
        );
        Ok(format!("{base}/api/{provider}/authorize?token={token}"))
    }
    pub async fn authorize(
        &self,
        db: &DatabaseConnection,
        provider: &str,
        input: Callback,
        base: &str,
    ) -> Result<String> {
        let p = self.provider(provider)?;
        let mut tickets = self.0.tokens.lock().await;
        let ticket = tickets
            .get_mut(&input.token)
            .filter(|t| t.expires > Instant::now() && t.provider == provider)
            .ok_or(Error::Unauthorized)?;
        if input.code.is_none() {
            if ticket.state.is_some() {
                return Err(Error::Unauthorized);
            }
            let state = Uuid::new_v4().to_string();
            let redirect = format!("{base}/api/{provider}/authorize?token={}", input.token);
            ticket.state = Some(state.clone());
            ticket.redirect = Some(redirect.clone());
            let mut url = url::Url::parse(&p.authorize_url).map_err(anyhow::Error::from)?;
            url.query_pairs_mut().extend_pairs([
                ("client_id", p.client_id.as_str()),
                ("response_type", "code"),
                ("scope", p.scope.as_str()),
                ("redirect_uri", &redirect),
                ("state", &state),
            ]);
            return Ok(url.into());
        }
        if ticket.state.is_none() || ticket.state != input.state {
            return Err(Error::Unauthorized);
        }
        let ticket = tickets.remove(&input.token).ok_or(Error::Unauthorized)?;
        drop(tickets);
        let token = self
            .exchange(
                provider,
                vec![
                    ("grant_type", "authorization_code".into()),
                    ("code", input.code.expect("code")),
                    ("redirect_uri", ticket.redirect.expect("redirect")),
                ],
            )
            .await?;
        self.store(db, provider, &ticket.principal, token, None)
            .await?;
        Ok("/".into())
    }
    async fn exchange(&self, provider: &str, mut fields: Vec<(&str, String)>) -> Result<Token> {
        let p = self.provider(provider)?;
        fields.extend([
            ("client_id", p.client_id.clone()),
            ("client_secret", p.client_secret.clone()),
        ]);
        if provider == "withings" {
            fields.push(("action", "requesttoken".into()));
        }
        let response = self.0.http.post(&p.token_url).form(&fields).send().await?;
        if response.status().is_client_error() {
            return Err(Error::Reauthorize);
        }
        let response = response.error_for_status()?;
        let token = if provider == "withings" {
            let envelope: Envelope<Token> = response.json().await?;
            if envelope.status != 0 {
                return Err(Error::Reauthorize);
            }
            envelope.body.ok_or(Error::Reauthorize)?
        } else {
            response.json::<Token>().await?
        };
        if token.access_token.is_empty() || token.expires_in <= 0 {
            return Err(Error::Reauthorize);
        }
        Ok(token)
    }
    async fn store(
        &self,
        db: &DatabaseConnection,
        provider: &str,
        principal: &str,
        token: Token,
        old: Option<&oauth::Model>,
    ) -> Result<String> {
        let now = time::now();
        let expires = now
            .checked_add_signed(chrono::Duration::seconds(token.expires_in))
            .ok_or(Error::Reauthorize)?;
        let refresh = token
            .refresh_token
            .as_ref()
            .map(|r| self.0.cipher.encrypt(r).map(String::into_bytes))
            .transpose()?
            .or_else(|| old.and_then(|o| o.refresh_token_value.clone()));
        let model = oauth::ActiveModel {
            client_registration_id: Set(format!("{provider}-client")),
            principal_name: Set(principal.into()),
            access_token_type: Set("Bearer".into()),
            access_token_value: Set(self.0.cipher.encrypt(&token.access_token)?.into_bytes()),
            access_token_issued_at: Set(now),
            access_token_expires_at: Set(expires),
            access_token_scopes: Set(token
                .scope
                .or_else(|| Some(self.provider(provider).expect("provider").scope.clone()))),
            refresh_token_value: Set(refresh),
            refresh_token_issued_at: Set(Some(now)),
            created_at: Set(old.map_or(now, |o| o.created_at)),
        };
        oauth::Entity::insert(model)
            .on_conflict(
                OnConflict::columns([
                    oauth::Column::ClientRegistrationId,
                    oauth::Column::PrincipalName,
                ])
                .update_columns([
                    oauth::Column::AccessTokenType,
                    oauth::Column::AccessTokenValue,
                    oauth::Column::AccessTokenIssuedAt,
                    oauth::Column::AccessTokenExpiresAt,
                    oauth::Column::AccessTokenScopes,
                    oauth::Column::RefreshTokenValue,
                    oauth::Column::RefreshTokenIssuedAt,
                ])
                .to_owned(),
            )
            .exec(db)
            .await?;
        Ok(token.access_token)
    }
    async fn access(
        &self,
        db: &DatabaseConnection,
        provider: &str,
        principal: &str,
    ) -> Result<String> {
        let old = oauth::Entity::find_by_id((format!("{provider}-client"), principal.to_owned()))
            .one(db)
            .await?
            .ok_or(Error::Reauthorize)?;
        if old.access_token_expires_at > time::now() + chrono::Duration::seconds(60) {
            return Ok(self.0.cipher.decrypt(
                std::str::from_utf8(&old.access_token_value).map_err(anyhow::Error::from)?,
            )?);
        }
        let refresh = old.refresh_token_value.as_ref().ok_or(Error::Reauthorize)?;
        let refresh = self
            .0
            .cipher
            .decrypt(std::str::from_utf8(refresh).map_err(anyhow::Error::from)?)?;
        match self
            .exchange(
                provider,
                vec![
                    ("grant_type", "refresh_token".into()),
                    ("refresh_token", refresh),
                ],
            )
            .await
        {
            Ok(token) => self.store(db, provider, principal, token, Some(&old)).await,
            Err(Error::Reauthorize) => {
                oauth::Entity::delete_by_id((format!("{provider}-client"), principal.to_owned()))
                    .exec(db)
                    .await?;
                Err(Error::Reauthorize)
            }
            Err(e) => Err(e),
        }
    }
    pub async fn sync(
        &self,
        db: &DatabaseConnection,
        provider: &str,
        principal: &str,
        zone: Tz,
    ) -> Result<()> {
        let _guard = self.0.sync.lock().await;
        let token = self.access(db, provider, principal).await?;
        match provider {
            "withings" => self.weight(db, &token, zone).await,
            "strava" => self.rides(db, &token, zone).await,
            _ => Err(Error::NotFound),
        }
    }
    async fn weight(&self, db: &DatabaseConnection, token: &str, zone: Tz) -> Result<()> {
        let (start, end) = time::range(Some(1), zone)?;
        let response = self
            .0
            .http
            .post(format!("{}/measure", self.0.settings.withings.api_url))
            .bearer_auth(token)
            .query(&[
                ("action", "getmeas".to_owned()),
                ("category", "1".into()),
                (
                    "startdate",
                    start.expect("start").and_utc().timestamp().to_string(),
                ),
                ("enddate", end.and_utc().timestamp().to_string()),
            ])
            .send()
            .await?;
        let envelope: Envelope<Measures> = checked(response)?.json().await?;
        if envelope.status == 401 {
            return Err(Error::Reauthorize);
        }
        if envelope.status != 0 {
            return Err(Error::Internal(anyhow::anyhow!(
                "Withings rejected measurement request: {}",
                envelope.status
            )));
        }
        let body = envelope
            .body
            .ok_or_else(|| Error::Internal(anyhow::anyhow!("Missing Withings body")))?;
        if let Some(group) = body.measuregrps.last() {
            let value = |kind| {
                group
                    .measures
                    .iter()
                    .find(|m| m.kind == kind)
                    .map(|m| ((m.value * 10f64.powi(m.unit) * 10.).round() / 10.) as f32)
            };
            if let Some(weight) = value(1) {
                let at = DateTime::from_timestamp(group.date, 0)
                    .ok_or_else(|| Error::Internal(anyhow::anyhow!("Invalid measure date")))?
                    .naive_utc();
                weight::Entity::insert(weight::ActiveModel {
                    created_at: Set(at),
                    weight: Set(Some(weight)),
                    fat_ratio: Set(value(6)),
                    fat_mass_weight: Set(value(8)),
                })
                .on_conflict(
                    OnConflict::column(weight::Column::CreatedAt)
                        .update_columns([
                            weight::Column::Weight,
                            weight::Column::FatRatio,
                            weight::Column::FatMassWeight,
                        ])
                        .to_owned(),
                )
                .exec(db)
                .await?;
            }
        }
        Ok(())
    }
    async fn rides(&self, db: &DatabaseConnection, token: &str, zone: Tz) -> Result<()> {
        let (start, end) = time::range(Some(1), zone)?;
        let base = &self.0.settings.strava.api_url;
        let summaries: Vec<Summary> = checked(
            self.0
                .http
                .get(format!("{base}/api/v3/athlete/activities"))
                .bearer_auth(token)
                .query(&[
                    ("after", start.expect("start").and_utc().timestamp()),
                    ("before", end.and_utc().timestamp()),
                ])
                .send()
                .await?,
        )?
        .json()
        .await?;
        let tx = db.begin().await?;
        for summary in summaries.into_iter().filter(|s| {
            matches!(
                s.sport_type.as_str(),
                "Ride" | "GravelRide" | "MountainBikeRide" | "VirtualRide"
            )
        }) {
            let a: Activity = checked(
                self.0
                    .http
                    .get(format!("{base}/api/v3/activities/{}", summary.id))
                    .bearer_auth(token)
                    .send()
                    .await?,
            )?
            .json()
            .await?;
            let model = ride::Model {
                created_at: a.start_date.naive_utc(),
                name: Some(a.name),
                sport_type: Some(a.sport_type),
                moving_time: Some(a.moving_time),
                distance: Some(a.distance),
                total_elevation_gain: Some(a.total_elevation_gain),
                weighted_average_watts: a.weighted_average_watts,
                calories: Some(a.calories),
                suffer_score: a.suffer_score.or(summary.suffer_score),
            };
            ride::Entity::insert(model.into_active_model())
                .on_conflict(
                    OnConflict::column(ride::Column::CreatedAt)
                        .update_columns([
                            ride::Column::Name,
                            ride::Column::SportType,
                            ride::Column::MovingTime,
                            ride::Column::Distance,
                            ride::Column::TotalElevationGain,
                            ride::Column::WeightedAverageWatts,
                            ride::Column::Calories,
                            ride::Column::SufferScore,
                        ])
                        .to_owned(),
                )
                .exec(&tx)
                .await?;
            for e in a
                .segment_efforts
                .into_iter()
                .filter(|e| e.segment.average_grade >= 0. && e.elapsed_time >= 120)
            {
                let id = e.segment.id;
                if segment::Entity::find_by_id(id).one(&tx).await?.is_none() {
                    let response = self
                        .0
                        .http
                        .get(format!("{base}/api/v3/segments/{id}/streams"))
                        .bearer_auth(token)
                        .query(&[
                            ("keys", "distance,altitude,latlng"),
                            ("key_by_type", "true"),
                        ])
                        .send()
                        .await;
                    match response {
                        Ok(response) if response.status().is_success() => {
                            let streams: Streams = response.json().await?;
                            let pairs = streams.latlng.map(|s| s.data).unwrap_or_default();
                            segment::ActiveModel {
                                id: Set(id),
                                latitudes: Set(serde_json::json!(
                                    pairs.iter().map(|p| p[0]).collect::<Vec<_>>()
                                )),
                                longitudes: Set(serde_json::json!(
                                    pairs.iter().map(|p| p[1]).collect::<Vec<_>>()
                                )),
                                distances: Set(serde_json::json!(
                                    streams.distance.map(|s| s.data).unwrap_or_default()
                                )),
                                altitudes: Set(serde_json::json!(
                                    streams.altitude.map(|s| s.data).unwrap_or_default()
                                )),
                                updated_at: Set(time::now()),
                            }
                            .insert(&tx)
                            .await?;
                        }
                        _ => tracing::warn!(
                            segment_id = id,
                            "Segment stream unavailable; retry on next sync"
                        ),
                    }
                }
                let model = segment_effort::Model {
                    id: e.id,
                    segment_id: id,
                    segment_name: e.segment.name,
                    segment_distance: e.segment.distance,
                    segment_average_grade: e.segment.average_grade,
                    elapsed_time: e.elapsed_time,
                    start_date: e.start_date.naive_utc(),
                    ride_created_at: a.start_date.naive_utc(),
                    average_watts: e.average_watts,
                };
                segment_effort::Entity::insert(model.into_active_model())
                    .on_conflict(
                        OnConflict::column(segment_effort::Column::Id)
                            .update_columns([
                                segment_effort::Column::SegmentId,
                                segment_effort::Column::SegmentName,
                                segment_effort::Column::SegmentDistance,
                                segment_effort::Column::SegmentAverageGrade,
                                segment_effort::Column::ElapsedTime,
                                segment_effort::Column::StartDate,
                                segment_effort::Column::RideCreatedAt,
                                segment_effort::Column::AverageWatts,
                            ])
                            .to_owned(),
                    )
                    .exec(&tx)
                    .await?;
            }
        }
        tx.commit().await?;
        super::measurements::recompute(db, zone).await
    }
    pub fn schedule(&self, db: DatabaseConnection) -> anyhow::Result<()> {
        if self.0.settings.daily_sync.cron == "-" {
            return Ok(());
        }
        let schedule = self.0.settings.daily_sync.cron.parse::<cron::Schedule>()?;
        let zone = self.0.settings.daily_sync.zone;
        let service = self.clone();
        tokio::spawn(async move {
            while let Some(next) = schedule.upcoming(zone).next() {
                let Ok(delay) = (next.with_timezone(&Utc) - Utc::now()).to_std() else {
                    continue;
                };
                tokio::time::sleep(delay).await;
                for provider in ["withings", "strava"] {
                    match oauth::Entity::find()
                        .filter(
                            oauth::Column::ClientRegistrationId.eq(format!("{provider}-client")),
                        )
                        .all(&db)
                        .await
                    {
                        Ok(clients) => {
                            for client in clients {
                                if let Err(error) = service
                                    .sync(&db, provider, &client.principal_name, zone)
                                    .await
                                {
                                    tracing::error!(%error,provider,"Scheduled sync failed");
                                }
                            }
                        }
                        Err(error) => {
                            tracing::error!(%error,provider,"Cannot load scheduled clients")
                        }
                    }
                }
            }
        });
        Ok(())
    }
}
fn checked(response: reqwest::Response) -> Result<reqwest::Response> {
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        Err(Error::Reauthorize)
    } else {
        Ok(response.error_for_status()?)
    }
}
#[derive(Deserialize)]
struct Measures {
    #[serde(default)]
    measuregrps: Vec<MeasureGroup>,
}
#[derive(Deserialize)]
struct MeasureGroup {
    date: i64,
    #[serde(default)]
    measures: Vec<Measure>,
}
#[derive(Deserialize)]
struct Measure {
    #[serde(rename = "type")]
    kind: i32,
    value: f64,
    unit: i32,
}
#[derive(Deserialize)]
struct Summary {
    id: i64,
    sport_type: String,
    suffer_score: Option<f32>,
}
#[derive(Deserialize)]
struct Activity {
    start_date: DateTime<Utc>,
    name: String,
    sport_type: String,
    moving_time: i32,
    distance: f32,
    total_elevation_gain: f32,
    weighted_average_watts: Option<f32>,
    calories: f32,
    suffer_score: Option<f32>,
    #[serde(default)]
    segment_efforts: Vec<Effort>,
}
#[derive(Deserialize)]
struct Effort {
    id: i64,
    segment: Segment,
    elapsed_time: i32,
    start_date: DateTime<Utc>,
    average_watts: Option<f32>,
}
#[derive(Deserialize)]
struct Segment {
    id: i64,
    name: String,
    distance: f32,
    average_grade: f32,
}
#[derive(Deserialize)]
struct Stream<T> {
    data: Vec<T>,
}
#[derive(Deserialize)]
struct Streams {
    latlng: Option<Stream<[f32; 2]>>,
    distance: Option<Stream<f32>>,
    altitude: Option<Stream<f32>>,
}
