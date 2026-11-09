# Restore Angular and Spring Boot

The owner requested this rollback on 2026-11-09 because of visual regressions
and because Rust is not the target backend language.

Reverse PRs #208, #206, #204, #203 and #202, restoring the application, build,
tests and deployment to `60b616e`. Keep gateway/static hosting, integration
routes and the November 6 resource sizing.

The Rust baseline adopted existing databases only after Liquibase change
`37-time-based-reading-goals`, leaving that history and persisted data intact.
Deploy Spring against the existing schema; do not run SeaORM down migrations,
replay clearing migrations or restore an old database snapshot. SeaORM metadata
can remain unused. Databases first created by Rust without Liquibase history
need separate adoption work before using this release.

The rollback is an ordinary forward commit and publishes new numbered releases.
CI must validate native builds and Playwright before merge. Production checks
include dashboard/day goals, reading, device API keys, OAuth callbacks and
provider sync using the existing encrypted credentials.
