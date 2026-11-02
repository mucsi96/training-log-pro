# Training Log Pro

## Reading goals

Click a book on the dashboard to record your new page and reading minutes using
the two dials. Saving requires advancing past the last recorded page and entering
1–1440 minutes. Daily reading goals in Settings use minutes, summed across books
and sessions in your local timezone. Book completion and reading pace still use pages.

The migration keeps existing reading-goal numbers as minute targets; adjust them
in Settings as needed. Existing page history and achieved days are preserved.
Historical entries and KOReader page-only syncs have no recorded duration and do
not contribute minutes to daily goals.

## Pomodoro timer

On desktop, click **Start Pomodoro** in the header to start a 25-minute focus
session. The remaining time appears in the header and browser tab, and the tab's
donut favicon shrinks from green through orange to red as time runs out. The
timer continues across in-app navigation and catches up after a background tab
or computer sleep.

At completion, the tab title and favicon flash until you click **Dismiss
Pomodoro**. You can cancel a running session with its close button. On supported
desktop browsers over HTTPS (or localhost), starting a session also requests
notification permission; allowing it enables a system notification at completion.
Clicking that notification focuses the tab and dismisses the alert.

## Gateway authentication and static hosting

Production documents are authenticated by the per-app Entra/oauth2-proxy gateway
before Angular starts. OAuth tokens stay in the server-side Redis session; the
browser uses a host-only HttpOnly session cookie. The API still validates the JWT
audience, scope and application roles, and preserves the `oid` principal used by
stored Strava/Withings credentials. Browser mutations require a CSRF header and
the host-only `__Host-XSRF-TOKEN` cookie. The HTTP test profile uses `XSRF-TOKEN`.

The client reads display data from `/oauth2/userinfo`; expired sessions return to
`/oauth2/start` with the current route. `/api/environment` is authenticated and
only supplies the map configuration. Faro's `training-log-client` name and
same-origin `/_telemetry/collect` URL are compiled into the client.

The pipeline builds one static client artifact and tests it before publication.
Azure's public `assets` Blob container serves bundles, lazy chunks, local fonts,
icons and the manifest using exact app-origin CORS. The document retains its
app-origin base URL and the manifest's navigation URLs target the app origin.
Uploads retain old bundles and publish `$web/index.html` only after all assets.
The `static-client-app` 5.0.0 chart replaces the client Deployment with an
authenticated HTTPS website origin; `spring-app` 37.0.0 gates API sessions.

`deploy/integrations` owns more-specific routes for GET Strava/Withings OAuth
callbacks, POST KOReader sync, and GET/DELETE device book delivery. These routes
preserve the original Authorization header and use the backend's one-time-token
or device API-key authentication, including ownership checks. They do not use
browser sessions. No database migration or token re-encryption is needed.

### Coordinated rollout

1. Merge and apply [p07 #69](https://github.com/mucsi96/p07/pull/69) to provision the
   Web registration, per-app gateway/Redis session, Azure storage, upload grants,
   `forward-auth-config` and `client-storage-config` deployment secrets, and
   same-origin Faro route. p07 retains the old SPA registration during rollout.
2. Merge this application migration. CI publishes the tested static assets,
   installs the integration routes, then deploys the API and static client charts
   with `--reset-values` to remove obsolete chart settings.
3. Verify signed-out documents redirect, APIs return 401, signed-in mutations and
   external provider reconnection work, device sync/download works, telemetry
   returns 202, and old client Deployments are gone. Retire the unused SPA
   registration in a subsequent p07 change after confirming rollout.

Infrastructure provisioning must precede the app deployment. Production Entra,
Azure CORS and Gateway API routing require rollout checks; the Playwright app
suite supplies gateway identity while exercising the real JWT/CSRF backend and
cross-origin static assets. Shared gateway behavior is owned by the pinned charts.

For local development, use an authenticated gateway in front of the Angular dev
server and API, forwarding `/oauth2` to oauth2-proxy. Direct standalone browser
OIDC login is no longer supported. `scripts/pod_up.sh` plus `cd test && npm test`
provides the isolated app test stack, with gateway identity supplied by fixtures.

## Container images

- [Server](https://github.com/users/mucsi96/packages/container/package/training-log-pro-server)
Client releases contain the tested `client-static.tar.gz` artifact rather than an image.

## Azure Key Vault Secrets

All application secrets are pulled from Azure Key Vault using the Spring Cloud Azure Key Vault Secrets starter. The only environment variable required at runtime is `AZURE_KEYVAULT_ENDPOINT`.

| Secret Name | Description | Reference |
|---|---|---|
| `tenant-id` | Azure AD tenant ID | [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) |
| `api-client-id` | Azure AD API application (server) client ID | [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) |
| `api-client-secret` | Azure AD API application client secret (local profile only) | [Azure Portal > App registrations > Certificates & secrets](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) |
| `spa-client-id` | Legacy SPA client ID retained during the coordinated rollout; the gateway client does not read it | [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) |
| `db-url` | PostgreSQL JDBC connection URL | [Azure Portal > Azure Database for PostgreSQL](https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.DBforPostgreSQL%2FflexibleServers) |
| `db-username` | PostgreSQL username | [Azure Portal > Azure Database for PostgreSQL](https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.DBforPostgreSQL%2FflexibleServers) |
| `db-password` | PostgreSQL password | [Azure Portal > Azure Database for PostgreSQL](https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.DBforPostgreSQL%2FflexibleServers) |
| `withings-client-id` | Withings OAuth2 client ID | [Withings Developer Dashboard](https://developer.withings.com/dashboard/) |
| `withings-client-secret` | Withings OAuth2 client secret | [Withings Developer Dashboard](https://developer.withings.com/dashboard/) |
| `strava-client-id` | Strava OAuth2 client ID | [Strava API Settings](https://www.strava.com/settings/api) |
| `strava-client-secret` | Strava OAuth2 client secret | [Strava API Settings](https://www.strava.com/settings/api) |
| `token-encryption-key` | Base64-encoded 256-bit AES key used to encrypt stored Strava/Withings OAuth tokens at rest. Generate with `openssl rand -base64 32`. | Self-generated |

## One image per Spring profile

The server is shipped as a GraalVM native executable. Bean definitions are
resolved during ahead-of-time processing at build time, so the active Spring
profile is baked into the executable and cannot be chosen at startup any more.
The server image is therefore built once per profile, via the `SPRING_PROFILE`
build argument:

```bash
podman build --build-arg SPRING_PROFILE=test -t training-log-pro-server:test server   # e2e pod
podman build --build-arg SPRING_PROFILE=prod -t training-log-pro-server:prod server   # published image
```

`SPRING_PROFILES_ACTIVE` is not read at runtime; the pipeline builds the test
image for the e2e job and the prod image when publishing to GHCR. Running
the server on a JVM for local development is unaffected - `mvn spring-boot:run
-Dspring-boot.run.profiles=local` still selects the profile the usual way.

## Runtime Environment Variables

| Variable | Description |
|---|---|
| `AZURE_KEYVAULT_ENDPOINT` | Azure Key Vault endpoint URL |
| `SPRING_ACTUATOR_PORT` | Port for Spring Boot Actuator endpoints |

## Port Mapping

All host-bound ports use the 80-89 range to avoid conflicts.

| Port | Service | Context |
|------|---------|---------|
| 3080 | Mock Withings API | Test pod |
| 3081 | Mock Strava API | Test pod |
| 5480 | PostgreSQL | Test pod |
| 5481 | PostgreSQL | Test DB pod |
| 5482 | PostgreSQL | Dev pod |
| 8080 | Spring Boot server | Test pod (internal, behind Traefik) |
| 8081 | Spring Boot server | Local dev (VSCode) |
| 8089 | Mock OAuth2 provider | Test pod |
| 8180 | Traefik HTTP | Test pod |
| 8181 | Traefik dashboard | Test pod |
| 4280 | Angular dev server | Local dev |
| 8182 | Spring Boot actuator | Test pod / Local dev |
