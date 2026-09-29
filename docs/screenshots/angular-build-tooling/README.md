# Angular build tooling migration verification

Screenshots captured from the rebuilt production client container with the test
stack running, after migrating the remaining CLI targets to `@angular/build`.

Verification command (from `test/`):

```bash
npx playwright test tests/mobile-dashboard.spec.ts
```

Both tests passed. All eight generated screenshots were visually inspected:
desktop overview, phone overview, smaller-phone overview, expanded reading
details, Training, Health, and collapsed/expanded ride achievements. No visible
layout breakage was found. Tests also checked mobile horizontal overflow,
navigation, task persistence, and the pushup dialog.

Representative screenshots:

- [Desktop overview (1440 × 1000 viewport)](desktop-overview.png)
- [Phone overview (390 × 844 viewport)](iphone-overview.png)

These are post-change smoke-check captures, not pixel-diff baselines. The desktop
capture occurs later in the test, after changing the range and completing a task.
