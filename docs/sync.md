# Track3 sync protocol (v1)

## Storage and encryption

Sync objects use an S3 compatible bucket over HTTPS, including custom HTTPS
ports. Local MinIO development can use `http://localhost` or
`http://127.0.0.1` on any port. The Tauri HTTP capability grants these origins;
the sync client itself rejects other plaintext HTTP endpoints. A virtual host
endpoint requires a bucket name that works as a DNS label and a TLS certificate
covering the resulting bucket host. Path style works with MinIO and endpoints
that have a path prefix.

The plaintext `sync-header` object contains format version 1, a random 16 byte
salt, Argon2id settings (64 MiB, 3 iterations, one lane), and an encrypted key
check. A passphrase derives a 32 byte key with Argon2id. The key check detects
a wrong passphrase or damaged header. Losing the sync passphrase makes the
synced data unrecoverable. Anyone with the header can attempt offline
passphrase guesses, so the passphrase must be strong.

Each encrypted object is a JSON envelope with version 1, a random 12 byte
AES-GCM nonce, and AES-256-GCM ciphertext with a 128 bit tag. Authenticated
additional data binds the ciphertext to its remote object path and format
version. The lower-level `EncryptedStore` also binds its logical path inside
the ciphertext. An HKDF derived naming key separates object naming from
encryption.

The provider can see the bucket, object classes, object count, sizes,
modification times, request timing, `sync-header` KDF settings, and each
device UUID. It cannot read values, passphrases, logical snapshot IDs, or
message content. The provider can delete objects or replay older valid
ciphertext; AES-GCM detects edits and object swaps but cannot detect rollback
by itself. S3 credentials are sent only in SigV4 authorization headers over
HTTPS or to the explicitly allowed local HTTP endpoints.

The engine checks that the provider rejects `If-None-Match: *` on an existing
object and stale `If-Match` ETags before each write round. A provider that
ignores those conditions cannot safely host multi-device sync.

## Device objects

Each installation stores a random device UUID and hybrid logical clock in its
local `sync_state` table. It writes only to `devices/<device UUID>/`. A snapshot
object contains one refresh UUID and its `assets_v2`, `asset_prices`, and
`transactions` rows. It is immutable. Remote SQLite row IDs are translated to
new local IDs when importing prices and transactions. A transaction and a
`sync_applied_objects` marker make repeat imports harmless.

Configuration uses one object per changed key and version. The key
classification is in `src/middlelayers/sync/config-keys.ts`. Exchange, wallet, stock
broker, and assistant settings are decrypted from local storage before the
passphrase encryption, then encrypted with the destination's local key after
pull. They are included when the `secrets` category is enabled (the default).
Local sync state stores keyed HMAC fingerprints of config values, including
secrets, rather than plain SHA-256 digests of decrypted keys.
License, app version, machine ID, backup paths, and import bookkeeping stay
local. Rebalance targets use the `rebalance` category. The goals category is
reserved for the goals schema when it lands.

If a joining device already has a different value for the same config key,
the remote LWW value replaces its local value and the sync report names the
key in `conflicts`. This applies to whole exchange, wallet, and stock config
rows: local entries in that row are lost unless the user saved a backup before
joining. Snapshot rows remain local when their UUID is unique.

The local HLC for a config value is currently stamped when sync detects the
change, not when the setting is saved. An older offline edit that syncs after
a newer remote edit can therefore win. The LWW clock reflects publication
order for such edits.

Tombstone objects contain a refresh UUID, an HLC timestamp, and a `deleted`
flag. A deletion masks the snapshot even if another device still has it. Undo
emits a newer event with `deleted: false`, allowing the immutable snapshot to
be imported again. The optimistic snapshot delete toast calls
`recordDeletion` and `recordUndo` through `delete-hook.ts` when sync is active.
Local snapshot changes are detected from the last synced content hash.
SQLite revision triggers identify changed snapshot UUIDs so unchanged history
is not read and hashed on every sync round. The local `sync_state` JSON row
still grows with snapshot count. Edits and individual asset deletions publish
a versioned snapshot edit; applying an edit replaces that snapshot in one
SQLite transaction. Per-asset deletion events and transaction field events
merge across concurrent edits. A whole
snapshot deletion publishes a tombstone, including when it happened while the
sync engine was unregistered. A snapshot tombstone wins over a concurrent edit.

Each chat session revision has its own encrypted object. New messages receive
an ID and append timestamp in the local encrypted session file. Merge takes
the union of messages by ID and orders them by timestamp, then ID. Legacy messages
without IDs receive stable IDs derived from session ID, index, and message
content on export. This preserves old conversations while newly merged
messages retain IDs in the encrypted session file. Session deletions publish
their own tombstones, and the manifest retains only the current session
revision. Payloads above the single-object plaintext limit are split into
encrypted 8 MiB parts referenced by their encrypted root object; each part
has its own checksum. A published revision supersedes old copies, which are
removed from the device's prefix after the manifest write succeeds. Payloads
are capped at 256 MiB.

The manifest retains only the latest config value and tombstone per key from
each device. Older encrypted config and tombstone objects can remain in the
bucket but are no longer referenced by the manifest. Immutable snapshot
entries still accumulate. A manifest above 8 MiB or 100,000 entries is
rejected; at that point sync cannot publish more snapshots until a future
retention or compaction protocol is available.

## Sync round

1. Validate `sync-header` with the passphrase.
2. List all device manifests, using S3 pagination. The per-device manifest is
   the only publication point for its objects.
3. Download unknown referenced objects. Enforce the 32 MiB encrypted object
   size limit and the 256 MiB multipart payload limit,
   verify SHA-256 of the encrypted bytes, authenticate and decrypt, then import
   snapshots by UUID. Merge configuration with HLC ordering (physical
   milliseconds, counter, device UUID) and sessions by message ID.
   Remote clocks more than 24 hours ahead of the local clock are rejected
   and retried on a later round.
4. Write new local objects with `If-None-Match: *`. Write the encrypted local
   manifest **last**, with `If-Match` against the prior ETag (or
   `If-None-Match: *` on creation). A failed write leaves an unreferenced
   object; the next round verifies and reuses it.
5. Persist local sync state and notify the app through the soft refresh event.

`SyncEngine.syncOnce({ signal, onProgress, categories })` returns counts,
conflicts, and sanitized errors. `dryRun()` estimates changes without writing
the database or object store. `status()` exposes the local device ID, clock,
and last successful sync time.
To use the desktop adapter, construct it with `createSqliteSyncEngine`; call
the returned `unregister` when sync is disabled. The settings and scheduler
wiring is part of the next PR.

Malformed individual objects are reported and retried on the next round. A
missing or invalid passphrase stops the round before local changes. The first
round downloads existing manifests and merges without deleting local-only
snapshots. Old tombstone and version objects remain for now; compaction needs a
device acknowledgement or retention policy so an offline device cannot
resurrect deleted data.
