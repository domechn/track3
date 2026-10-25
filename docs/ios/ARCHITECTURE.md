# Track3 iOS architecture

Track3 keeps its Tauri v2 architecture: the iPhone React shell runs in
WKWebView and invokes the shared Rust core. `src/main.tsx` selects
`src/App.tsx` for desktop and lazily loads `src/mobile/App.tsx` on iOS.
Mobile routes and presentation live in `src/mobile/components/`, while
`src/components/` remains the master desktop interface. Unchanged UI
primitives are imported from the desktop component directory. The existing
SQL migrations, refresh persistence, sync persistence, encryption, and key
rotation code remain shared with desktop. The iOS identifier is
`dev.track3.ios`; the desktop identifier remains unchanged.
`src-tauri/src/app.rs` holds the shared Tauri entry and commands; desktop
`main.rs` calls it, while the iOS library entry is exported through `lib.rs`.
Cargo selects the native iOS dependency only for the iOS target. Desktop
release settings stay in `tauri.conf.json` and `tauri.release.conf.json`;
`tauri.ios.conf.json` and `capabilities/mobile.json` supply iOS settings
without changing the desktop updater and permissions.

The mobile shell loads `src/mobile/ios-style.css` and its component CSS.
Its translation catalog preserves the iPhone wording; the shared provider
uses the master catalog for desktop. [PLATFORM_SPLIT.md](PLATFORM_SPLIT.md)
records each file from master that the port changed.

## Storage and secrets

Tauri resolves `app_data_dir`, `app_config_dir`, `app_cache_dir`, and
`resource_dir` inside the iOS app sandbox. SQLite and assistant session files
live under application data, coin logos under cache, and bundled migration SQL
under resources. Startup still resolves any legacy configuration database
before creating a new database. Frontend SQL uses the Rust-selected absolute
database URL, so it opens the same database as migrations and refresh.

The generated iOS Xcode project sets
`com.apple.developer.default-data-protection` to
`NSFileProtectionCompleteUntilFirstUserAuthentication`. This is iOS Data
Protection backed by the device passcode and hardware keys, and applies to new
files in the app sandbox. The app expects the device to have been unlocked
once after reboot. SQLite assets and transactions rely on iOS Data Protection
for at-rest protection; sensitive configuration and assistant content also
use app-layer encryption.

Fresh iOS installs create a random encryption key before database setup and
store it in a device-only Keychain item. An existing protected `.ent-key`
is migrated to Keychain on launch. Installs that already have a database but
no key retain legacy-key compatibility. A simulator without the needed
Keychain entitlement uses a protected, backup-excluded key file. Other
Keychain failures leave the portfolio locked and the database closed until
retry succeeds.

The recoverable rotation protocol updates Keychain and encrypted database
and session content. Its crash-recovery journal can briefly contain key
material; iOS Data Protection covers it, and the app excludes key artifacts
from iCloud and Finder backups. A restored database can therefore lack its
device-bound key. The startup recovery notice links to Settings when
configuration is unreadable. A generated key is not shown to users, so a
configuration export encrypted with it is also unrecoverable after restore.
For a recoverable configuration export, set a known key in Security, export
configuration, and keep that key separately. Device backup and restore still
need validation on a signed build.

`scripts/ios/configure-project.py` applies the Data Protection entitlement and
syncs Xcode version settings from `tauri.conf.json`. The committed Info.plist
reads those settings. `src-tauri/Info.ios.plist`
supplies display name, permissions copy, file sharing, and orientations when
Tauri generates or refreshes the project.

## Platform behavior

Desktop updater, process relaunch, shell, and right-click menu are omitted on
iOS. Dialog, filesystem, HTTP, opener, notification, and SQL plugins remain
available. The frontend platform provider exposes iOS and phone detection,
safe-area insets, and visual-viewport keyboard overlap. The iPhone interface
uses bottom tabs, a back stack, sheets, and touch controls. The iOS default
theme follows the system unless a saved preference overrides it.

The desktop-only assistant chat export CLI uses a macOS home directory. It is
not invoked by the mobile app or built as part of the mobile library target.
Rust persistence modules otherwise use paths supplied by Tauri and standard
file APIs within the sandbox. `fs2` instance locking and `libc::O_NOFOLLOW`
remain supported Unix operations; key rotation keeps its existing fsync and
recovery behavior.

The iOS document picker creates an empty file under a unique name in Documents.
The frontend stages export content under the app cache, copies it to the
selected path after the picker closes, and removes the cache file. It removes
the empty Documents placeholder on cancellation or after a successful export
to an external path. It keeps the selected Documents file when the picker
returns that path with or without iOS's `/private` alias.
This prevents an earlier Documents export from being overwritten or deleted
when the user cancels. Desktop exports write directly to the selected path.
Automatic backups can use Track3's Documents directory or a folder selected in
Files, including iCloud Drive. The native folder picker opens folders in place
and saves a security-scoped bookmark in UserDefaults. Startup resolves the
auto-backup bookmark and grants the restored path to Tauri's runtime filesystem
scope before the webview starts auto import and backup. The import picker has a
separate bookmark, so a one-time import does not replace the auto-backup folder.
Users can opt to promote a selected parent import folder to the auto-backup
folder. Clearing the auto-backup folder removes its bookmark; Undo can restore
that bookmark during the current process. The app Documents directory uses
its existing Files permission even though it has no runtime bookmark.
A stale bookmark is renewed on restore, and the resolved path replaces an old
configuration path; an inaccessible or deleted folder is
shown in Backup settings with a Choose folder again action. Before reading a
backup tree, native code requests iCloud downloads and waits up to 90 seconds;
a fresh URL resource-value check on each poll observes download completion.
A download failure stops the import instead of treating a placeholder as an
empty backup. Choosing `track3-backup` or one of its client folders resolves to
its parent for import. For a selected client folder, Track3 reads only that
client within its granted security scope. The JSON file picker continues to
use the dialog plugin's `.json` UTType filter.

The simulator debug build enables a frontend probe that waits for rendered
content, including the empty portfolio on a fresh install, and invokes a
debug-only Rust command to write a readiness marker in the app cache. An
early script and the React error boundary also send startup errors to an
app-cache log in probe builds. CI checks its first screenshot after 20 seconds,
prints any frontend errors, and then polls for the readiness marker.
