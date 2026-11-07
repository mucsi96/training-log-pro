# Training Log server

Rust/Loco with SeaORM/PostgreSQL. The reference architecture is
[skeleton-app](https://github.com/mucsi96/skeleton-app).

```bash
cargo build --locked
cargo fmt --all -- --check
cargo clippy --locked --all-targets -- -D warnings
DATABASE_URL=postgres://postgres:postgres@localhost:5480/test \
  cargo run -- start --environment test
```

The test configuration expects the mock provider and integration servers in the
test pod. `scripts/pod_up.sh` builds and runs the complete stack. For development,
start the dev database with `scripts/dev_up.sh`, configure the variables in
`config/development.yaml`, and run `cargo run -- start --environment development`.
Browser access requires the authenticated gateway described in the root README.

## Layout

- `app.rs`: Loco lifecycle, configuration and middleware registration.
- `controllers.rs`: API routes and typed request extraction.
- `services/`: business operations, transactions, integrations and scheduled sync.
- `models.rs`: SeaORM mappings of the existing application schema.
- `migration/`: irreversible baseline for fresh databases and adoption of existing data.
- `middleware.rs`: JWT scope/role authorization and browser CSRF.
- `crypto.rs`: existing AES-256-GCM encrypted token format.

## Upgrade and configuration

Deploy the final Spring release (Liquibase change `37-time-based-reading-goals`)
before this server. The baseline verifies that marker and adopts the database
without changing rows, identifiers, timestamps, encrypted tokens or Liquibase
history. Fresh databases receive the final schema and initial gold requirements.
Partial/older databases fail startup rather than being reset. Migration rollback,
truncation and seed operations are deliberately unavailable.

Production uses `LOCO_ENV=production`, `AZURE_KEYVAULT_ENDPOINT` and the Azure
workload identity environment. The same Key Vault secret names remain valid,
including separate DB credentials and a JDBC-prefixed `db-url`. OAuth tokens
remain encrypted using the existing `token-encryption-key`.

`PORT` defaults to 8080. `/healthz` reports database readiness. `--healthcheck`
performs the native container probe. `DAILY_SYNC_CRON` defaults to `0 0 21 * * *`
and `DAILY_SYNC_ZONE` to `Europe/Budapest`. Withings sync precedes Strava so FTP
uses today's weight; failures are logged per client without stopping other clients.

Behavior is verified exclusively with the Playwright suite in `test/`, including
database-backed assertions and the external-provider mock servers.
