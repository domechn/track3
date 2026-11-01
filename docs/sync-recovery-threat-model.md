# Sync recovery file threat model

## Scope and asset

The `.t3key` file contains only the 32 byte sync root key, encrypted under a required, separate file passphrase. It contains no local encryption key, S3 endpoint, bucket name, settings, or credentials. The root key can decrypt and forge every object in the configured sync bucket. Treat the file and its passphrase as sensitive. Losing both the sync passphrase and a usable recovery file makes the remote data unreadable.

The file is independent of existing Track3 exports and backups. It adds no database schema or sync object kind, and it does not change the sync header or 0.9.4 wire format.

## Attackers and controls

| Attacker capability | Consequence and control |
| --- | --- |
| Gets the file but not its passphrase | Can make offline guesses. Argon2id uses 64 MiB, 3 iterations, and parallelism 1. AES-256-GCM authenticates the root key and every header field. Require a unique file passphrase of at least 16 characters. |
| Reads the S3 bucket | Can already attack the sync header's passphrase offline with the same Argon2id cost. The recovery file provides a second offline target if also obtained. |
| Has the file, its passphrase, and bucket access | Can read and modify all synced data. The UI warns before export. A weak passphrase can still be guessed despite the length rule. |
| Uses an unlocked app | Export still requires re-entry of the current sync passphrase. iOS also requires `ios_authenticate` before the encrypted file is shared. |
| Alters or truncates the file | Exact format and size checks reject malformed files; GCM authentication rejects changes. A recovered key must pass the live bucket header's key check before it is used. |
| Replaces the bucket after “Forget remote data” | A new header has a different salt and root key. An old file is rejected. |
| Reads logs or diagnostics | Recovery code emits no secrets to logs, errors, telemetry, or diagnostics. User-facing errors are fixed strings. Passphrases and the root key are not persisted by the recovery code. |

## File and platform boundary

Version 1 is UTF-8 JSON with `format`, `version`, `createdAt`, `header.salt`, exact Argon2id parameters, an AES-GCM nonce, and a 48 byte ciphertext including the tag. The ciphertext plaintext is exactly the 32 byte root key. The AES key is HKDF-SHA-256 over Argon2id(file passphrase), with salt `track3-sync-recovery-v1` and info `file-key`. Canonical JSON of every field except `ciphertext` is authenticated as AAD. Readers accept only version 1 and an exact field set and reject files over 4096 bytes.

On desktop the save dialog receives encrypted JSON only. On iOS the share sheet receives an encrypted staging file in cache, and its staging directory is removed when sharing finishes or fails. The app never writes the plaintext key. The destination selected in the share sheet may retain the encrypted file, as intended.
The suggested filename includes a sanitized bucket hint, which may reveal part of the bucket name to someone who sees the filename.
Temporary mutable key buffers are cleared after use, and the active root key is cleared when sync stops. JavaScript passphrase strings cannot be reliably zeroed before garbage collection.

Malware running in the app process, device memory extraction, shoulder surfing, and a compromised OS are outside this model. Real iOS authentication, Files, and share sheet behavior require device verification before release.

## Review checklist

Review the parser's bounds and exact parameter checks, Argon2id and HKDF separation from normal sync keys, AES-GCM AAD, re-entry and iOS authentication order, live header verification before session activation, and the absence of raw error logging. Run the known-answer vector and the wrong-passphrase, tampering, truncation, wrong-bucket, file IO, and staging cleanup tests.

The new vector is recorded in `tests/golden/t3key-v1.json`. To regenerate it for a reviewed format change, run `UPDATE_T3KEY_GOLDEN=1 corepack yarn vitest run src/middlelayers/sync/recovery-file.test.ts` and review the entire diff.
