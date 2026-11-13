# Disk-backed device book transfers

The device queue is temporary: files expire after **24 hours**. New EPUB bytes
never enter PostgreSQL. `training_log.device_book` stores the device, filename,
content type, creation time, and required file size. There is no `data` column
or database-payload download path.

## Storage and deployment

Production uses the existing `training-log-app` persistent volume on p07,
backed by `/data/training-log`. The application's Helm deployment claims it as
`training-log-pvc` and mounts it at `/app/storage`. Files live exclusively under
`/app/storage/device-books`. As in Learn Language, `STORAGE_DIRECTORY` configures
the `/app/storage` root through `storage.directory`; device-book storage uses its
own subfolder. The local Spring profile uses `./storage` as the root.

The naming follows the same convention as Learn Language: `<app>-app` for the
p07-owned PV and `<app>-pvc` for the application Helm chart's claim, with an empty
storage class, `ReadWriteOnce`, and a 5Gi request.

This is disk storage, not a memory-backed emptyDir or host `/tmp`. Files survive
container and pod replacement on p07. The volume is node-local; moving to a
different node requires migrating its files. Its advertised 5Gi capacity is not
a filesystem quota. The queue directory is not included in folder backups, and
`device_book` data is excluded from p07 database backups.

`scripts/deploy.sh` sets the Deployment strategy to **Recreate** before upgrades
and after installation (spring-app 37 does not expose a strategy value):
the old bytea-only server must stop before the new server starts publishing
metadata-only rows. This causes brief API downtime during deployment. The
old database-backed queue entries are removed by the migration before dropping
`data`; those temporary uploads must be sent again. Disk-backed queue entries
are retained. Do not
roll back to the bytea-only server after disk-backed books have been queued.

## Lifecycle and cleanup

- Multipart uploads are spooled to disk (`file-size-threshold: 0`).
- Upload bytes stream to a UUID-named `.part` file. The file is flushed, renamed
  atomically to `.epub`, and its directory synced before metadata commits.
- Failed uploads remove their partial file. A failed metadata insert also
  removes the completed file; crash leftovers are collected on the next flow.
- Downloads stream from disk and retain the file until the device sends its
  existing acknowledgement request. Disconnects do not acknowledge a file.
- Acknowledgement/manual removal commits the device-scoped metadata deletion,
  then removes the file. Removing a device also collects its queued files.
- Startup and every queue listing/upload/download/removal perform a full sweep:
  expired metadata is deleted, along with orphaned `.epub` files and abandoned
  `.part` files. Fresh queued files and unrelated directory entries are retained.
- Queue operations, including downloads, are serialized by a JVM monitor plus
  a filesystem lock. Cleanup cannot remove an active transfer, and processes
  sharing the volume cannot race publication/deletion. A second transfer waits
  for the first; this low-volume e-reader queue favors correctness over parallel
  transfer throughput. Locks are released even when a client disconnects.

Cleanup runs when a flow is triggered, rather than on a timer; a completely idle
queue can retain expired files until the next operation or server startup.

## Verification

```sh
scripts/pod_up.sh
cd test
npx playwright test tests/devices.spec.ts
```

The native test stack mounts a host directory at the same container path and
uses production limits for **both** the server (384 MiB) and PostgreSQL 18.4
(300 MiB). Coverage includes a 96 MiB incompressible upload with no database
payload, interrupted and checksum-verified downloads, acknowledgements,
device isolation, the metadata-only database schema, expiry/orphan cleanup, and retention
plus startup cleanup across a server restart.
