# Training Log Pro client

React function components, React Router, TanStack Query, Zod, and
`@mucsi96/react-ui`, built with Vite. Component styles are colocated CSS Modules.
The Rust/Loco backend preserves the application's API and persisted data contracts.

## Development and verification

Use Node 24 or newer and the committed npm lockfile:

```sh
npm ci
npm start          # Vite on 4280; API proxy to 8081, gateway proxy to 8180
npm run lint
npm run typecheck
npm run build      # static artifact in dist/
```

Use an authenticated gateway for local browser sessions. Behavioral coverage is
the repository's Playwright suite: from the repository root run
`scripts/pod_up.sh`, then `cd test && npm test`. No client unit test runner is used.

## Data and authentication

`api.ts` validates responses with the schemas in `schemas.ts`, sends the user's
timezone, and attaches CSRF proof to same-origin mutations. Bootstrap reads the
authenticated `/api/environment` map configuration before starting queries that
mutate data. `/oauth2/userinfo` is display-only; session expiry returns to the
gateway with the current deep link. External provider authorization remains a
backend-owned flow, with Withings syncing before Strava. Query keys deduplicate
sync and measurements; mutations invalidate the affected resources and goals.

Routes `/`, `/year`, and `/all-time` preserve the `view=training|health` query
parameter. `/settings` and `/devices` load on demand. The header timer survives
client-side navigation. ECharts and MapLibre instances are disposed on unmount.

## Static delivery

Vite uses relative asset URLs so lazy chunks, CSS and map assets work on the
public Blob asset origin. `scripts/prepare-client.mjs` rewrites HTML references
while retaining the application's `/` document base. API and Faro URLs resolve
against `window.location.origin`, never the asset origin. The same `dist/`
artifact is mounted into nginx for E2E, attached to the client release, and
published by the existing static-hosting deployment.
