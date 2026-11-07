use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Settings {
    pub oidc: Oidc,
    pub csrf_secure: bool,
    pub token_encryption_key: String,
    pub thunderforest_api_key: String,
    pub strava: Provider,
    pub withings: Provider,
    pub daily_sync: DailySync,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Oidc {
    pub issuer: String,
    pub audience: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Provider {
    pub client_id: String,
    pub client_secret: String,
    pub authorize_url: String,
    pub token_url: String,
    pub api_url: String,
    pub scope: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DailySync {
    pub cron: String,
    pub zone: chrono_tz::Tz,
}

impl Settings {
    pub fn validate(&self) -> anyhow::Result<()> {
        anyhow::ensure!(!self.oidc.audience.is_empty(), "OIDC audience required");
        crate::middleware::validate_endpoint(&self.oidc.issuer)?;
        for p in [&self.strava, &self.withings] {
            anyhow::ensure!(
                !p.client_id.is_empty() && !p.client_secret.is_empty(),
                "Integration credentials required"
            );
            for url in [&p.authorize_url, &p.token_url, &p.api_url] {
                crate::middleware::validate_endpoint(url)?;
            }
        }
        if self.daily_sync.cron != "-" {
            self.daily_sync.cron.parse::<cron::Schedule>()?;
        }
        Ok(())
    }
}
