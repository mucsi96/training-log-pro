use crate::{
    controllers, crypto::Cipher, key_vault, middleware::Auth, services::integrations::Integrations,
    settings::Settings,
};
use async_trait::async_trait;
use axum::{Extension, Router, extract::DefaultBodyLimit, middleware};
use loco_rs::{
    Result,
    app::{AppContext, Hooks},
    bgworker::Queue,
    boot::{self, BootResult, StartMode},
    config::Config,
    controller::{AppRoutes, Routes, monitoring},
    environment::Environment,
    task::Tasks,
};
use migration::Migrator;
use std::path::Path;
pub struct App;
#[async_trait]
impl Hooks for App {
    fn app_name() -> &'static str {
        env!("CARGO_PKG_NAME")
    }
    fn app_version() -> String {
        env!("CARGO_PKG_VERSION").into()
    }
    async fn load_config(environment: &Environment) -> Result<Config> {
        let mut config = environment.load()?;
        if *environment == Environment::Production {
            key_vault::configure(&mut config)
                .await
                .map_err(|e| loco_rs::Error::Any(e.into()))?;
        }
        let mut uri = url::Url::parse(&config.database.uri).map_err(loco_rs::Error::wrap)?;
        uri.query_pairs_mut()
            .append_pair("options", "-csearch_path=training_log,public");
        config.database.uri = uri.into();
        config
            .settings::<Settings>()?
            .validate()
            .map_err(|e| loco_rs::Error::Any(e.into()))?;
        Ok(config)
    }
    async fn boot(
        mode: StartMode,
        environment: &Environment,
        config: Config,
    ) -> Result<BootResult> {
        boot::create_app::<Self, Migrator>(mode, environment, config).await
    }
    fn routes(_: &AppContext) -> AppRoutes {
        AppRoutes::empty()
            .add_route(controllers::routes())
            .add_route(Routes::new().get("/healthz", monitoring::readiness))
    }
    async fn after_routes(router: Router, ctx: &AppContext) -> Result<Router> {
        let settings: Settings = ctx.config.settings()?;
        let auth = Auth::new(settings.oidc.issuer.clone(), settings.oidc.audience.clone())
            .await
            .map_err(|e| loco_rs::Error::Any(e.into()))?;
        let cipher = Cipher::new(&settings.token_encryption_key)
            .map_err(|e| loco_rs::Error::Any(e.into()))?;
        let integrations = Integrations::new(settings.clone(), cipher.clone())
            .map_err(|e| loco_rs::Error::Any(e.into()))?;
        integrations
            .schedule(ctx.db.clone())
            .map_err(|e| loco_rs::Error::Any(e.into()))?;
        Ok(router
            .layer(DefaultBodyLimit::max(100 * 1024 * 1024))
            .layer(Extension(cipher))
            .layer(Extension(integrations))
            .layer(middleware::from_fn_with_state(
                auth,
                crate::middleware::authorize,
            ))
            .layer(middleware::from_fn_with_state(
                settings.csrf_secure,
                crate::middleware::csrf,
            )))
    }
    async fn connect_workers(_: &AppContext, _: &Queue) -> Result<()> {
        Ok(())
    }
    fn register_tasks(_: &mut Tasks) {}
    async fn truncate(_: &AppContext) -> Result<()> {
        Err(loco_rs::Error::Message("Truncation is disabled".into()))
    }
    async fn seed(_: &AppContext, _: &Path) -> Result<()> {
        Err(loco_rs::Error::Message("Seeding is disabled".into()))
    }
}
