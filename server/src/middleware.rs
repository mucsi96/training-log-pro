use axum::{
    extract::{Request, State},
    http::{Method, StatusCode, header},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header, jwk::JwkSet};
use serde::Deserialize;
use std::{
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct Auth(Arc<Inner>);
struct Inner {
    issuer: String,
    audience: String,
    jwks_url: String,
    client: reqwest::Client,
    keys: Mutex<(Instant, JwkSet)>,
}
#[derive(Deserialize)]
struct Discovery {
    issuer: String,
    jwks_uri: String,
}
#[derive(Clone, Deserialize)]
pub struct Claims {
    pub oid: String,
    #[serde(default)]
    scp: String,
    #[serde(default)]
    roles: Vec<String>,
}
pub fn validate_endpoint(value: &str) -> anyhow::Result<()> {
    let url = url::Url::parse(value)?;
    let local = matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "[::1]"));
    anyhow::ensure!(
        url.scheme() == "https" || (url.scheme() == "http" && local),
        "Endpoint requires HTTPS or loopback HTTP"
    );
    anyhow::ensure!(
        url.username().is_empty()
            && url.password().is_none()
            && url.fragment().is_none()
            && url.query().is_none(),
        "Invalid endpoint"
    );
    Ok(())
}
impl Auth {
    pub async fn new(issuer: String, audience: String) -> anyhow::Result<Self> {
        validate_endpoint(&issuer)?;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::none())
            .build()?;
        let discovery: Discovery = client
            .get(format!("{issuer}/.well-known/openid-configuration"))
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        anyhow::ensure!(discovery.issuer == issuer, "OIDC issuer mismatch");
        validate_endpoint(&discovery.jwks_uri)?;
        let keys = client
            .get(&discovery.jwks_uri)
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        Ok(Self(Arc::new(Inner {
            issuer,
            audience,
            jwks_url: discovery.jwks_uri,
            client,
            keys: Mutex::new((Instant::now(), keys)),
        })))
    }
    async fn verify(&self, token: &str) -> Result<Claims, StatusCode> {
        let h = decode_header(token).map_err(|_| StatusCode::UNAUTHORIZED)?;
        if h.alg != Algorithm::RS256 {
            return Err(StatusCode::UNAUTHORIZED);
        }
        let kid = h.kid.ok_or(StatusCode::UNAUTHORIZED)?;
        let mut cache = self.0.keys.lock().await;
        if cache.0.elapsed() >= Duration::from_secs(300) {
            let keys = self
                .0
                .client
                .get(&self.0.jwks_url)
                .send()
                .await
                .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
                .error_for_status()
                .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
                .json()
                .await
                .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
            *cache = (Instant::now(), keys);
        }
        let key = DecodingKey::from_jwk(cache.1.find(&kid).ok_or(StatusCode::UNAUTHORIZED)?)
            .map_err(|_| StatusCode::UNAUTHORIZED)?;
        drop(cache);
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[&self.0.issuer]);
        validation.set_audience(&[&self.0.audience]);
        validation.validate_nbf = true;
        let claims = decode::<Claims>(token, &key, &validation)
            .map_err(|_| StatusCode::UNAUTHORIZED)?
            .claims;
        if claims.oid.is_empty() || !claims.scp.split_whitespace().any(|s| s == "api-access") {
            return Err(StatusCode::FORBIDDEN);
        }
        Ok(claims)
    }
}
pub fn external(path: &str) -> bool {
    path == "/api/reading/koreader-sync"
        || path == "/api/device/books"
        || path.starts_with("/api/device/books/")
}
pub async fn authorize(
    State(auth): State<Auth>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let path = request.uri().path();
    if path == "/healthz"
        || external(path)
        || matches!(path, "/api/strava/authorize" | "/api/withings/authorize")
    {
        return Ok(next.run(request).await);
    }
    let token = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;
    let claims = auth.verify(token).await?;
    let role = if request.method() == Method::GET || path == "/api/day-goal/celebrate" {
        "readWorkouts"
    } else {
        "createWorkout"
    };
    if path != "/api/environment" && !claims.roles.iter().any(|r| r == role) {
        return Err(StatusCode::FORBIDDEN);
    }
    request.extensions_mut().insert(claims);
    Ok(next.run(request).await)
}
pub async fn csrf(
    State(secure): State<bool>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if external(request.uri().path()) {
        return Ok(next.run(request).await);
    }
    let name = if secure {
        "__Host-XSRF-TOKEN="
    } else {
        "XSRF-TOKEN="
    };
    let cookie = request
        .headers()
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .find_map(|v| v.trim().strip_prefix(name))
        .filter(|v| uuid::Uuid::parse_str(v).is_ok())
        .map(str::to_owned);
    if !matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS | Method::TRACE
    ) && !cookie.as_ref().is_some_and(|c| {
        request
            .headers()
            .get("X-XSRF-TOKEN")
            .is_some_and(|h| h.as_bytes() == c.as_bytes())
    }) {
        return Err(StatusCode::FORBIDDEN);
    }
    let mut response = next.run(request).await;
    if cookie.is_none() {
        response.headers_mut().append(
            header::SET_COOKIE,
            format!(
                "{name}{}; Path=/; {}SameSite=Lax",
                uuid::Uuid::new_v4(),
                if secure { "Secure; " } else { "" }
            )
            .parse()
            .expect("valid cookie"),
        );
    }
    Ok(response)
}
