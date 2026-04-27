# Training Log Pro

## Docker images

- [Server](https://hub.docker.com/repository/docker/mucsi96/training-log-pro-server)
- [Client](https://hub.docker.com/repository/docker/mucsi96/training-log-pro-client)

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

## Runtime Environment Variables

| Variable | Description |
|---|---|
| `AZURE_KEYVAULT_ENDPOINT` | Azure Key Vault endpoint URL |
| `SPRING_ACTUATOR_PORT` | Port for Spring Boot Actuator endpoints |
| `SPRING_PROFILES_ACTIVE` | Active Spring profile (`prod`, `local`, `test`) |

## Port Mapping

All host-bound ports use the 80-89 range to avoid conflicts.

| Port | Service | Context |
|------|---------|---------|
| 3080 | Mock Withings API | Test pod |
| 3081 | Mock Strava API | Test pod |
| 5480 | PostgreSQL | Test pod |
| 5481 | PostgreSQL | Test DB pod |
| 5482 | PostgreSQL | Dev pod |
| 8089 | Mock OAuth2 provider | Test pod |
| 8180 | Traefik HTTP | Test pod |
| 8181 | Traefik dashboard | Test pod |
| 8182 | Spring Boot actuator | Test pod / Local dev |
