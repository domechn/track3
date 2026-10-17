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
check. A passphrase derives a 32 byte root key with Argon2id. HKDF-SHA-256
with salt `track3-sync-v1` derives an AES-256-GCM key with info
`object-encryption`, an HMAC naming key with info `object-names`, and a
configuration fingerprint key with info `config-fingerprints`.
The key check detects
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
object and stale `If-Match` ETags before each write round. Both HTTP 409
`ConditionalRequestConflict` and 412 `PreconditionFailed` mean a conditional
write conflict. Conditional PUTs are never blindly retried after a server
failure because the first attempt may already have succeeded. A provider that
ignores write conditions cannot safely host multi-device sync.

## Device objects

Each installation stores a random device UUID and hybrid logical clock in its
local `sync_state` table. The state also stores the header salt; when the
configured bucket has a different header, the device keeps its UUID, clock,
pending snapshot deletions, tracked chat sessions, and pending chat deletions,
but clears publication markers so it can upload
its local data again without losing unpublished deletions. It writes
only to `devices/<device UUID>/`. A snapshot
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
local. Rebalance targets use the `rebalance` category. Goals and alert rules
stay on each device; there is no Goals sync switch.

If a joining device already has a different value for the same config key,
sync keeps the local value and records a persistent conflict by key ID. In
Sync settings, **Keep local** publishes that value with a clock newer than
the conflicting remote version; **Use remote** applies the remote value. No
secret value appears in the conflict state or UI. This uses an explicit
choice instead of a local backup: the original value remains in place until
the user chooses. The choice applies to the whole exchange, wallet, stock, or
assistant config row. Snapshot rows remain local when their UUID is unique.

Before applying a remote snapshot deletion, sync reads the local snapshot
even if the revision index reports no change. An unpushed content change or
a newer local edit keeps the snapshot and publishes a newer keep event.
After a store reset, a missing local hash alone does not count as a change:
sync compares available remote content first and rebuilds the baseline used
to publish later edits. Chat deletions similarly retain a newer local session
or unpushed change, and a retained session gets a newer timestamp so other
devices can pull it.

Config LWW compares `(physical milliseconds, counter, device UUID)` from
the HLC. A local value gets its clock when an enabled sync round first detects
that its HMAC fingerprint changed, not when the user saves it. Pending values
keep that clock through retries. Thus the winning value follows detection
time and HLC ordering, not necessarily the time of the user's edit: an older
offline edit detected in a later round can replace a newer edit from another
device. On a device with no prior clock for a key, an existing remote value
wins the initial conflict.

Tombstone objects contain a refresh UUID, an HLC timestamp, and a `deleted`
flag. A deletion masks the snapshot even if another device still has it. Undo
emits a newer event with `deleted: false`, allowing the immutable snapshot to
be imported again. The optimistic snapshot delete toast calls
`recordDeletion` and `recordUndo` through `delete-hook.ts` when sync is active.
Local snapshot changes are detected from the last synced content hash.
SQLite revision triggers identify changed snapshot UUIDs so unchanged history
is not read and hashed on every sync round. After a successful deletion round,
the `sync_state` row drops cached asset and transaction rows for deleted
snapshots and rebuilds them after Undo. Snapshot hashes and edit events remain
for reconciliation. The single JSON row still grows with active snapshot
count and retained history.
Edits and individual asset deletions publish
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
messages retain IDs in the encrypted session file. The local adapter reuses
unchanged sessions in memory based on SQLite metadata, avoiding repeated
file reads and decryption in each round. Session deletions publish
their own tombstones, and the manifest retains only the current session
revision. After a deletion is published, `sync_state` drops the session's
old content hash and tracked-session marker. Payloads above the single-object
plaintext limit are split into
encrypted 8 MiB parts referenced by their encrypted root object; each part
has its own checksum. A published revision supersedes old copies, which are
removed from the device's prefix after the manifest write succeeds. Payloads
are capped at 256 MiB.

The manifest retains only the latest config value and tombstone per key from
each device. Older encrypted config and tombstone objects can remain in the
bucket but are no longer referenced by the manifest. Immutable snapshot
entries still accumulate. A serialized encrypted manifest above 8 MiB or
100,000 entries is rejected on read or write.
The byte cap is expected to bind first, around 30,000–40,000 entries depending
on ID and version lengths. Once reached, new pushes fail until the protocol
supports smaller manifests. A future protocol should shard immutable snapshot
entries, for example by month, and publish an authenticated per-device shard
index last. Existing v1 readers must not mistake a partial sharded view for
the complete history.

Manifests may include a 60 character encrypted device name. Readers accept
older manifests without a name. The current device publishes its name on the
next sync; labels assigned locally to other devices remain local overrides.

V1 does not garbage collect published snapshot tombstones or their underlying
snapshot objects. Removing either without a safe checkpoint could let a
long-offline device republish a deleted snapshot. Tombstone GC needs a
versioned checkpoint acknowledged by every active device, a way to retire
devices that will never return, and a rule that forces retired or stale devices
to rebuild from that checkpoint before they can publish again. Only then can
older tombstones and masked snapshot objects be removed.

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
the returned `unregister` when sync is disabled. `SyncRuntime` owns the
desktop adapter, session passphrase, and `SyncScheduler`. The scheduler
debounces triggers, keeps one round in flight, throttles focus, and retries
failures with exponential backoff. After five consecutive failed rounds it
stops automatic retry and marks the indicator accordingly. **Sync now** or a
successful portfolio refresh starts a new attempt sequence; focus alone does
not. It never blocks a portfolio refresh.

Malformed individual objects are reported. Partial rounds retry with exponential
backoff; permanently damaged remote data needs repair before a retry can succeed.
A missing remote header, invalid passphrase, access error, or invalid configuration
stops automatic retries and shows the reason. The first
round downloads existing manifests and merges without deleting local-only
snapshots. Old tombstone and version objects remain for now; compaction needs a
device acknowledgement or retention policy so an offline device cannot
resurrect deleted data.

## User guide

Open **Settings → Sync**. Create a private bucket for Track3, then enter its
endpoint, region, bucket name, access key ID, and secret access key. A prefix
is optional when sharing a bucket. Use credentials scoped to that bucket and
prefix with list, read, write, and delete access. The connection test checks
listing, a temporary conditional write, cleanup, and an existing sync header.
It separates configuration, permission, missing bucket, network, unsupported
conditional write, damaged header, and passphrase failures without displaying
credentials.

- **Amazon S3:** enter the regional HTTPS endpoint, such as
  `https://s3.us-east-1.amazonaws.com`, the matching region, and the bucket.
  Path style works; virtual host style requires a bucket DNS name and a TLS
  certificate for the bucket host.
- **Cloudflare R2:** enter
  `https://<account-id>.r2.cloudflarestorage.com`, region `auto`, and the
  bucket. Enable path style.
- **MinIO:** enter its HTTPS endpoint and configured region with path style.
  Local development may use `http://localhost:<port>` or
  `http://127.0.0.1:<port>`. Plain HTTP to a remote host is rejected.

Choose a unique passphrase of at least 16 characters. When creating a new sync
bucket, confirm it before enabling. A device joining an existing bucket only
needs the existing passphrase. **The sync passphrase can NEVER be recovered.** Losing it makes all
remote data permanently unreadable, even with valid S3 credentials. Store it
in a safe place before enabling. Track3 keeps the passphrase in memory only
for the current app session. After a restart, unlock sync from the status
indicator or Sync settings; automatic sync starts after unlock. There is no
OS keychain option because Track3 has no existing keychain integration.

The category switches cover snapshot history, settings, exchange/wallet/
assistant secrets, rebalance targets, and assistant chats. Goals and alerts
stay on each device. Older saved sync settings with a `goals` flag still load;
the flag is ignored. Secrets are decrypted from each
device's local configuration and encrypted with the sync passphrase before
upload. Sync also stores S3 credentials in this device's encrypted
configuration row `991`; it never uploads that row. If that row cannot be
read, the status indicator and Sync settings ask for the S3 settings again;
sync remains off until those settings are saved. Licenses, local backup
paths, and machine IDs stay local. A first join with differing local settings
waits for a choice in Sync settings before applying either value.

Sync runs after unlock at app start, after a successful refresh, when the
window regains focus, and on **Sync now**. A change during a running round
starts one more round when it finishes. The small indicator shows progress,
errors, conflicts, and the last round's pulled and pushed counts. Pulling
snapshots refreshes the portfolio once after the round and shows the source
device IDs or names. This device's name is shared through its encrypted
manifest; names assigned to other devices stay local. The current installation
is marked **This device**. Device timestamps show the last manifest upload, which
can be earlier than the last sync round. A snapshot deletion and Undo publish matching tombstone
events; the delete sync waits until the Undo window ends so other devices do
not see a transient delete when Undo is pressed. **Disable sync** stops future sync while retaining local and remote
data. **Forget remote data** requires typing `FORGET`; it deletes `sync-header`
and `devices/` objects inside the configured prefix, then disables sync.
It leaves local data and unrelated bucket objects untouched. Disable sync on
other devices first; a device that remains active can upload its local data
again. Re-enabling this device after forgetting remote data also uploads its
remaining local data.
