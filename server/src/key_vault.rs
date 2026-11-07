use crate::settings::Settings;
use anyhow::Context;
use azure_identity::WorkloadIdentityCredential;
use azure_security_keyvault_secrets::SecretClient;
use loco_rs::config::Config;

pub async fn configure(config: &mut Config) -> anyhow::Result<()> {
    let endpoint =
        std::env::var("AZURE_KEYVAULT_ENDPOINT").context("AZURE_KEYVAULT_ENDPOINT is required")?;
    let client = SecretClient::new(&endpoint, WorkloadIdentityCredential::new(None)?, None)?;
    let database = secret(&client, "db-url").await?;
    let mut url = url::Url::parse(database.strip_prefix("jdbc:").unwrap_or(&database))?;
    anyhow::ensure!(
        matches!(url.scheme(), "postgres" | "postgresql"),
        "PostgreSQL URL required"
    );
    url.set_username(&secret(&client, "db-username").await?.replace('%', "%25"))
        .map_err(|_| anyhow::anyhow!("Invalid username"))?;
    url.set_password(Some(
        &secret(&client, "db-password").await?.replace('%', "%25"),
    ))
    .map_err(|_| anyhow::anyhow!("Invalid password"))?;
    config.database.uri = url.into();
    let mut s: Settings = config.settings()?;
    s.oidc.issuer = format!(
        "https://login.microsoftonline.com/{}/v2.0",
        secret(&client, "tenant-id").await?
    );
    s.oidc.audience = secret(&client, "api-client-id").await?;
    s.strava.client_id = secret(&client, "strava-client-id").await?;
    s.strava.client_secret = secret(&client, "strava-client-secret").await?;
    s.withings.client_id = secret(&client, "withings-client-id").await?;
    s.withings.client_secret = secret(&client, "withings-client-secret").await?;
    s.token_encryption_key = secret(&client, "token-encryption-key").await?;
    s.thunderforest_api_key = secret(&client, "thunderforest-api-key").await?;
    config.settings = Some(serde_json::to_value(s)?);
    Ok(())
}
async fn secret(client: &SecretClient, name: &str) -> anyhow::Result<String> {
    let value = client
        .get_secret(name, None)
        .await?
        .into_model()?
        .value
        .with_context(|| format!("Missing secret {name}"))?;
    anyhow::ensure!(!value.is_empty(), "Empty secret {name}");
    Ok(value)
}
