# Training Log Pro - Development Guidelines

## General Code Style

- Avoid fallbacks, prefer failing fast
- Prefer functional programming patterns
- Prefer immutable data structures

## Java Style

- Use Lombok annotations (@Data, @Builder, @RequiredArgsConstructor)
- Constructor injection (via @RequiredArgsConstructor)
- Use Stream API for collections
- Use records for DTOs/responses

## TypeScript Style

- Use `const` by default
- Prefer spread operator for object/array operations
- Use functional array methods (map, filter, reduce)
- Use string literals over enums

## Testing Style

- Write tests from user perspective
- Use role-based selectors (getByRole)
- Use semantic selectors (getByText, getByLabel)
- E2E tests with Playwright

## Angular Style

- Use Angular Material components
- Use signals and resources (not rxjs where possible)
- Use string literals over enums
- Standalone components

## Design

- Material UI dark theme
- Skeleton loaders for loading states

## Project Overview

Training and fitness tracking application demonstrating patterns for:
- CI/CD pipeline (GitHub Actions)
- Deployment (Docker images published to registry)
- Client (Angular with Material UI)
- Server (Spring Boot with Java)
- Authentication (Azure AD / MSAL)
- Configuration (Azure Key Vault, Spring profiles)
- Database (PostgreSQL with JPA)
- Testing (Playwright E2E)
- External API Integration (Strava, Withings)

## Architecture

- **client/** - Angular SPA with Material UI, MSAL authentication
- **server/** - Spring Boot REST API with PostgreSQL
- **test/** - Playwright E2E tests
- **scripts/** - Build and deployment scripts
- **.github/workflows/** - CI/CD pipelines

## Key Technologies

- Spring Boot 4, Java 21
- Angular with Material UI
- PostgreSQL
- Azure AD (MSAL) authentication
- Azure Key Vault for secrets
- Traefik reverse proxy
- Docker multi-stage builds
- Playwright for E2E testing

## Development Commands

### Frontend
```bash
cd client && npm start        # Start dev server
cd client && npm run build    # Production build
```

### Backend
```bash
cd server && mvn spring-boot:run -Dspring-boot.run.profiles=local  # Start with local profile
```

### Testing
```bash
scripts/compose_up.sh         # Start test stack
cd test && npm test           # Run E2E tests
cd test && npx playwright test --ui  # Interactive test runner
```

## Configuration Patterns

### Spring Profiles
- **prod** - Production with Azure Key Vault and AAD
- **local** - Local development with Docker Compose DB
- **test** - Testing with disabled auth

### Environment Config
- Server exposes `/api/environment` endpoint
- Client fetches config before bootstrap
- Conditionally enables MSAL based on `mockAuth` flag
