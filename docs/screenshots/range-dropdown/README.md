# Dashboard range dropdown

Actual Chromium screenshots from the running test stack, captured by
`test/tests/mobile-dashboard.spec.ts` after moving the range selector above the tabs.

- `iphone-overview.png`: Today with Month selected, 390 × 844 viewport (full-page capture).
- `desktop-overview.png`: Today with Year selected, 1440 × 1000 viewport.

To reproduce, start the test stack with the current client, then run from `test/`:

```bash
npx playwright test tests/mobile-dashboard.spec.ts
```

Screenshots are written to the test's directory under `test/test-results/`.
