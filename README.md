# Training Log Pro

## Docker images

- [Server](https://hub.docker.com/repository/docker/mucsi96/training-log-pro-server)
- [Client](https://hub.docker.com/repository/docker/mucsi96/training-log-pro-client)

## Azure Key Vault Secrets

All application secrets are pulled from Azure Key Vault using the Spring Cloud Azure Key Vault Secrets starter. The only environment variable required at runtime is `AZURE_KEYVAULT_ENDPOINT`.

| Secret Name | Description |
|---|---|
| `tenant-id` | Azure AD tenant ID |
| `api-client-id` | Azure AD API application (server) client ID |
| `api-client-secret` | Azure AD API application client secret (local profile only) |
| `spa-client-id` | Azure AD SPA application (client) client ID |
| `db-url` | PostgreSQL JDBC connection URL |
| `db-username` | PostgreSQL username |
| `db-password` | PostgreSQL password |
| `withings-client-id` | Withings OAuth2 client ID |
| `withings-client-secret` | Withings OAuth2 client secret |
| `withings-api-uri` | Withings API base URI |
| `withings-accounts-uri` | Withings OAuth2 accounts base URI |
| `strava-client-id` | Strava OAuth2 client ID |
| `strava-client-secret` | Strava OAuth2 client secret |
| `strava-api-uri` | Strava API base URI |
| `strava-username` | Strava account username |
| `strava-password` | Strava account password |

## Runtime Environment Variables

| Variable | Description |
|---|---|
| `AZURE_KEYVAULT_ENDPOINT` | Azure Key Vault endpoint URL |
| `SPRING_ACTUATOR_PORT` | Port for Spring Boot Actuator endpoints |
| `SPRING_PROFILES_ACTIVE` | Active Spring profile (`prod`, `local`, `test`) |
