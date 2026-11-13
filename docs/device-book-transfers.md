# Device book transfer memory

EPUBs remain in `training_log.device_book.data` as PostgreSQL `bytea`; existing
queued books and device API URLs remain compatible.

Uploads are spooled to disk by the multipart resolver (`file-size-threshold: 0`).
`DeviceBookStorage` supplies the input stream **and its known length** to pgjdbc,
which sends the parameter without buffering the whole file. Do not replace this
with `MultipartFile.getBytes()`, Hibernate binary persistence, or an unknown-length
JDBC stream: those can introduce full-file heap allocations and copies.

PostgreSQL's JDBC `getBinaryStream()` does not provide bounded-memory reads of
`bytea`. Downloads therefore select 64 KiB substrings and write each to the HTTP
response. Metadata and chunks share a read-only repeatable-read transaction, so
concurrent deletion cannot truncate a download. A disconnected client unwinds
the transaction and releases its transfer slot. EPUBs are already ZIP-compressed;
this approach retains the existing storage format without a data migration.

Two active storage transfers are permitted per server instance; excess transfers
receive HTTP 503 and can be retried. Deletion uses device-scoped bulk statements,
and the JPA entity no longer maps the payload. Listing, acknowledging a book, and
deleting a device therefore cannot accidentally hydrate its books' payloads.

The production memory limit remains 384 MiB. The test pod now uses that same
limit. `test/tests/devices.spec.ts` includes a nearly 100 MiB incompressible binary
upload, two concurrent checksum-verified downloads, acknowledgement, and device
isolation checks. Run it against the native test stack:

```sh
scripts/pod_up.sh
cd test
npx playwright test tests/devices.spec.ts
```
