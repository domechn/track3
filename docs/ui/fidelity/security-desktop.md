# Security desktop

Approved states: `security`, `security-lock-off`, `security-recovery-missing`, `security-rotate`, `security-rotating`, `security-rotated`. Source: `ds/pages/settings-b-security.html#<state>`. Shared measured shell and tokens: [settings-b-shell-desktop.md](settings-b-shell-desktop.md).

## Structure and exact content

The title is `Security`; subtitle: `Encryption of saved secrets and app lock.` The first row starts at x 320/y 110 with 723.7px and 512.3px cards, both 417px high. The second row starts at y 543 with two 308px cards. Grid gap is 16px.

1. **Encryption key**: green `In use` pill and three typographic values `Key ID k-7c41…e09a`, `Created 12 Jan 2026`, `Last rotated Never`. Four secret rows identify `Exchange API keys` (Binance, OKX; 2 secrets), `Broker token` (Interactive Brokers Flex Query; 1), `Assistant API key` (openrouter.ai; 1), and `Sync secret and passphrase check` (Cloudflare R2 bucket; 1). A `Rotate encryption key` pill and a 12px note finish the card.
2. **Recovery**: Saved or Not saved pill, amber warning banner, rows `Recovery key`, `Stored in macOS Keychain`, `Covers 5 secrets`, `For key`, and `Format Recovery file, .t3key`. The missing state says `Not exported` and `Not saved`. Footer includes `Show recovery key` and `Export recovery file`.
3. **App lock** and **Lock screen**: the source explicitly labels app lock `iPhone and iPad only` with an `iOS` pill. It shows Face ID/passcode, require on launch, a segmented timeout (Immediately/1 min/5 min), and a black lock preview. The off state turns toggles grey and adds an amber warning. These are source design illustrations of phone behaviour and may not be exposed as working desktop controls.

`security-rotate` uses a centred confirmation with a warning, four consequences, `Cancel` and pink `Rotate key`. `security-rotating` disables the action with a spinner. `security-rotated` shows a green banner and a bottom-right toast urging a new recovery export. Keep key material hidden, never render decrypted secrets, and use only the actual rotation/recovery capabilities.

## Remaining differences

The live Refresh and date-range controls remain visible in wide Settings; the static reference omits them. This keeps both actions available while viewing Settings.

Settings toasts retain a visible 44px close × target for keyboard and pointer dismissal; the reference toasts omit it.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

All six source renders and captures were viewed side by side. Screenshots: `/tmp/fidelity-desktop/security/<state>-desktop.png` (`security-desktop.png` for the default). Full-page 1600px pixel ratios at a 24/255 maximum-channel threshold:

| State | Differing pixels |
| --- | ---: |
| security | 3.08% |
| security-lock-off | 3.02% |
| security-recovery-missing | 3.10% |
| security-rotate | 5.41% |
| security-rotating | 3.57% |
| security-rotated | 4.38% |

- **Encryption key:** The app does not expose a public key ID, key creation timestamp, or last rotation timestamp. These values remain dashes; the source's `k-7c41…e09a`, `12 Jan 2026` and `Never` are invented. The four saved-secret rows now derive exchange/broker aliases, assistant endpoint host and the configured fake sync bucket from encrypted configuration without rendering credentials. The source shows hard-coded secret counts.
- **Recovery:** Track3 has a recovery-file flow for encrypted **sync** data, not a local application-encryption-key recovery stored in macOS Keychain. The fixture now unlocks fake sync and enables the real recovery Export action. No saved/exported status or local key recovery material exists to back the source's `Saved`, `Covers 5 secrets`, `.t3key` key ID and “Show recovery key” rows. Its row values, one missing action and warning wording visibly differ.
- **App lock and Lock screen:** The navigation map marks biometric app lock and timeouts as iOS-only. Desktop has no app-lock state, Face ID toggle, timeout selection or working unlock action. Both lower cards use iOS-only notices instead of displaying switch/segmented controls or a seemingly functional lock preview. Thus `security` and `security-lock-off` intentionally share the same desktop state, and both differ substantially in density from the source.
- **Rotate, rotating, rotated:** The real rotation command needs a new key and confirmation, which the source's warning-only confirmation omits. The app dialog includes those fields, so its height and text differ. `security-rotating` holds the actual command in progress through the fake bridge, and `security-rotated` displays the real success banner and toast. The source's updated key ID/time and “export a fresh local recovery key” instruction cannot be shown, since those values and recovery capability do not exist.

The remaining differences follow from the unavailable local key metadata and recovery state, iOS-only app lock, and the real rotation flow described above. The ratios above include the wide Settings strip and toast corrections.
