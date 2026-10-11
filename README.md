# Training Log Pro

## Container images

- [Server](https://github.com/users/mucsi96/packages/container/package/training-log-pro-server)
- [Client](https://github.com/users/mucsi96/packages/container/package/training-log-pro-client)

After tests pass, main pushes and manual `Pipeline` runs publish changed components to
GHCR with `GITHUB_TOKEN` and job-scoped `packages: write` permission, following
`observatory-app` for registry authentication while retaining numbered versions:

```text
ghcr.io/mucsi96/training-log-pro-server:<server version>
ghcr.io/mucsi96/training-log-pro-client:<client version>
```

Each component publishes only when `get_next_version.outputs.hasNextVersion`
is `true`, using `get_next_version.outputs.version` as its image tag. Unchanged
components retain the version of their last reachable `server-N` / `client-N`
release. Both resolved image references are passed directly to deployment.
Publication and rollout are serialized. The GHCR source label added to each
production Dockerfile triggers both first publications through normal version
detection; subsequent workflow-only changes skip image publication.
Make both GHCR packages public after their first publication, then rerun the
deploy job so Kubernetes can pull them anonymously.

For manual deployment, provide explicit versioned images:

```bash
AZURE_KEYVAULT_NAME=p07-training-log \
SERVER_IMAGE=ghcr.io/mucsi96/training-log-pro-server:42 \
CLIENT_IMAGE=ghcr.io/mucsi96/training-log-pro-client:17 \
bash scripts/deploy.sh
```

The script also accepts GHCR images pinned by `@sha256:<digest>`.

## Azure Key Vault Secrets

All application secrets are pulled from Azure Key Vault using the Spring Cloud Azure Key Vault Secrets starter. The only environment variable required at runtime is `AZURE_KEYVAULT_ENDPOINT`.

| Secret Name | Description | Reference |
|---|---|---|
| `tenant-id` | Azure AD tenant ID | [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) |
| `api-client-id` | Azure AD API application (server) client ID | [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) |
| `api-client-secret` | Azure AD API application client secret (local profile only) | [Azure Portal > App registrations > Certificates & secrets](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) |
| `spa-client-id` | Azure AD SPA application (client) client ID | [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) |
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
