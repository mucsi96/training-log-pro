# Training Log Pro — Development Guidelines

## Code review

- Review actionable correctness, security, data-loss and deployment regressions;
  cite the changed file/line and concrete impact.
- Preserve authentication boundaries, persisted data compatibility and documented
  build/test/deploy contracts. Adapt reference patterns to this application's domain.
- Report missing behavioral coverage when it catches a specific regression;
  leave formatting and mechanical checks to CI.

## Codex automation

Use native Codex GitHub reviews and `@codex` PR tasks with ChatGPT sign-in.
Setup: https://github.com/mucsi96/skeleton-app/blob/main/docs/codex-automation.md
Skeleton sync: follow `.github/prompts/sync-skeleton.md` in a weekly scheduled task.

## Style and architecture

- Fail fast; prefer functional patterns and immutable data.
- `server/`: Rust/Loco lifecycle and CLI, thin Axum controllers, typed Serde
  requests/settings, typed service errors, SeaORM models/migrations, structured tracing.
- `client/`: React/Vite, TanStack Query and Zod at API boundaries.
- TypeScript uses `const`, spread, functional collection methods and string literals.
- Use `@mucsi96/react-ui` documented APIs (`onPress`, `isDisabled`, semantic `tone`).
  Colocate styles in CSS Modules; global CSS contains tokens, resets and typography.
- Preserve accessible names, keyboard navigation, dark theme, skeleton loaders,
  actionable errors and retry states.
- API and telemetry URLs stay on the application origin. Browser OAuth credentials
  are forbidden; `/oauth2/userinfo` supplies display data, `/api/environment` map config.

## Verification

Playwright E2E tests in `test/` are the only behavioral test layer. Do not add
Rust unit/integration tests or React unit/component tests. Drive the running stack
and assert UI behavior, or use the database helpers in `test/utils.ts` for behavior
that is not visible. Use role/text/label selectors. Extend the mock Strava/Withings
servers rather than stubbing application services.

```bash
cd server && cargo fmt --all -- --check
cd server && cargo clippy --locked --all-targets -- -D warnings
cd server && cargo build --locked
cd client && npm run lint && npm run typecheck && npm run build
scripts/pod_up.sh
cd test && npm test
scripts/pod_down.sh
```

## Runtime and persistence contracts

- The same native image runs test and production; `LOCO_ENV` selects configuration
  at runtime. `/healthz` checks database readiness. `--healthcheck` is the native
  container probe; `--help` checks that the executable starts without infrastructure.
- Production configuration loads Azure Key Vault with workload identity before
  database connection. Preserve existing secret names and JDBC URL compatibility.
- `training_log` remains the schema; existing UUID/timestamp keys, UTC timestamp
  columns, OAuth principal `oid`, registration IDs, and AES-256-GCM wire format
  (Base64 of IV/ciphertext/tag) must remain compatible.
- The baseline adopts databases through Liquibase change 37 without altering data.
  Fresh databases alone receive initial settings. Never replay historical clearing
  migrations, reset/reseed existing data, or enable destructive Loco database options.
- Browser APIs validate JWT signature, issuer, audience, expiry, scope and roles.
  Mutations require double-submit CSRF even with gateway-injected bearer tokens.
- Device delivery/KOReader routes authenticate device API keys and check ownership.
  OAuth callbacks use expiring single-use state tied to the initiating principal.
- Scheduled sync runs Withings before Strava in `DAILY_SYNC_ZONE` using
  `DAILY_SYNC_CRON`, isolates provider failures, and refreshes encrypted credentials.

## Release and deployment

`publish-server` publishes numbered GHCR images only when
`get_next_version.outputs.hasNextVersion == 'true'`, tagging its `version` output.
Use job-scoped `packages: write` with `GITHUB_TOKEN`. Release tags target
`${{ github.sha }}`. Forward the version output directly to deployment; do not
perform consumer-side tag lookups. Serialize publication/rollout and require
numbered tags or digests. Keep the source label and public package visibility.

Keep release/service name `training-log-server`, workload identity and existing
integration routes. Use `rust-app` 7.0.0 and `static-client-app` 5.0.0 with
`--reset-values`. `deploy/integrations` preserves API-key/one-time-token routes;
never put browser session authentication in front of them. See README for rollout.

`publish-client` releases the tested static archive. Deployment empties `$web` and
`assets`, uploads assets first and index last (intentional downtime). Faro name and
same-origin collector path remain compiled into the client.
