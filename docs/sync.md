# Sync storage and crypto (PR 1)

Sync objects use an S3 compatible bucket over HTTPS, including custom HTTPS
ports. Local MinIO development can use `http://localhost` or
`http://127.0.0.1` on any port. The Tauri HTTP capability grants these origins;
the sync client itself rejects other plaintext HTTP endpoints. The existing
HTTPS HTTP capability supports the app's other data providers. A virtual host
endpoint requires a bucket name that works as a DNS label and a TLS certificate
covering the resulting bucket host. Path style works with MinIO and endpoints
that have a path prefix.

The plaintext `sync-header` object contains format version 1, a random 16 byte
salt, Argon2id settings (64 MiB, 3 iterations, one lane), and an encrypted key
check. A passphrase derives a 32 byte key with Argon2id. The key check detects
a wrong passphrase or damaged header. **There is no recovery: losing the sync
passphrase makes the synced data unrecoverable.** Anyone with the header can
attempt offline passphrase guesses, so the passphrase must be strong.

Each data object is a JSON envelope with version 1, a random 12 byte AES-GCM
nonce, and AES-256-GCM ciphertext with a 128 bit tag. Authenticated additional
data binds the ciphertext to its remote object path and format version. The
plaintext inside the ciphertext contains its logical path and JSON value.
Remote names have a visible object class, such as `snap/`, followed by a
keyed SHA-256 HMAC of the logical path. An HKDF derived naming key separates
object naming from encryption. The provider cannot read values, passphrases,
logical IDs, or month names. It can see the bucket, object classes, object
count, sizes, modification times, request timing, and `sync-header` KDF settings.
The provider can also delete objects or replay an older valid ciphertext; AES-GCM
detects edits and object swaps but cannot detect rollback by itself.
S3 credentials are sent only in SigV4 authorization headers over HTTPS or to
the explicitly allowed local HTTP endpoints.

The object store supports `If-None-Match: *` to create a manifest and
`If-Match: <ETag>` to replace one only when its revision is still current.
Providers vary in conditional write support; a provider that ignores these
headers cannot provide safe concurrent manifest updates. Later sync PRs must
detect such providers before enabling multi-device writes.
