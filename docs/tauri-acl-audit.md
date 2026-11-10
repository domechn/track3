# Tauri ACL audit (0.9.12 hotfix)

The desktop webview is `main`. `migrated.json` applies to it on macOS, Windows, and Linux; `mobile.json` applies to `main` on iOS. The old `desktop.json` had no `windows` or `webviews` target, so its `updater:default` granted nothing. This audit uses the Tauri permission definitions in `src-tauri/gen/schemas/acl-manifests.json` and the installed plugin JS command names. The guard in `src/test/tauri-acl.test.ts` scans non-test frontend source and expands permission sets from that manifest.

| Frontend call | Native command | Desktop `main` grant | iOS `main` grant |
| --- | --- | --- | --- |
| `check`; `Update.download`; `Update.install` | `plugin:updater\|check`, `download`, `install` | `updater:allow-check`, `updater:allow-download`, `updater:allow-install` | Not used; iOS does not self-update |
| `Update.close` | `plugin:resources\|close` | `core:default` → `core:resources:default` | Not used |
| `openUrl` (including the dynamic assistant import) | `plugin:opener\|open_url` | `opener:allow-open-url` | `opener:allow-open-url` |
| `relaunch` | `plugin:process\|restart` | `process:allow-restart` | Not used |
| `open`, `save` | `plugin:dialog\|open`, `save` | `dialog:default` | `dialog:default` |
| `exists`, `stat`, `readDir`, `readTextFile`, `writeTextFile`, `copyFile`, `rename`, `remove`, `mkdir` | `plugin:fs\|exists`, `stat`, `read_dir`, `read_text_file`, `write_text_file`, `copy_file`, `rename`, `remove`, `mkdir` | `fs:default`, explicit `fs:allow-*`, and `fs:allow-app-write*` / `write-all` sets | `fs:default`, explicit `fs:allow-*` including `copy-file`, and app/document directory sets |
| `fetch` | `plugin:http\|fetch`, `fetch_send`, `fetch_read_body`, `fetch_cancel`, `fetch_cancel_body` | `http:default` | `http:default` |
| `Database.load`, `db.select`, `db.execute` | `plugin:sql\|load`, `select`, `execute` | `sql:default`, `sql:allow-execute` | `sql:default`, `sql:allow-execute` |
| `isPermissionGranted` | `plugin:notification\|is_permission_granted` when browser permission is undecided | `notification:default` | `notification:default` |
| `api.app.getVersion`, `getTauriVersion`; `appDataDir`, `appCacheDir`, `documentDir`; `Menu.new`, `MenuItem.new`, `menu.popup` | `plugin:app\|version`, `tauri_version`; `plugin:path\|resolve_directory`; `plugin:menu\|new`, `popup` | `core:default` | `core:default` |

`requestPermission`, `sendNotification`, and every `navigator.clipboard.writeText` call use browser APIs in the installed plugin version. They issue no Tauri plugin command. There are no frontend imports of the clipboard manager, store, or shell plugins; the existing `shell:default` grant has no corresponding frontend call. No `openPath` or `process.exit` call was found. `updater:allow-download-and-install` remains granted for compatibility with the older combined updater API.

The opener scope now matches both HTTP and HTTPS URLs accepted by the release note and assistant link renderers on desktop and iOS. The docs link is HTTPS. The HTTP fetch scope still allows HTTPS and loopback HTTP only. The filesystem scope covers app directories and the configured home/document paths; the dialog plugin also adds a picked file or folder to the webview's filesystem scope when the user selects it.

Direct `invoke()` calls in `src/` target application commands registered by `app.rs`, rather than plugin ACL commands: `decrypt`, `decrypt_with_key`, `encrypt`, `get_database_url`, `persist_refresh`, `query_coins_prices`, `rotate_encryption_key`, `replace_import_snapshot`, `delete_local_asset`, `delete_local_snapshot`, `restore_local_asset`, `restore_local_snapshot`, `update_local_transaction_price`, `update_local_transaction_type`, `save_sync_state`, `import_sync_snapshot`, `replace_sync_snapshot`, `delete_sync_snapshot`, `mark_frontend_ready`, `record_frontend_error`, and the `ios_*` commands (`authenticate`, `auto_retry_allowed`, `backup_folder_status`, `clear_backup_folder`, `haptic`, `key_recovery_needed`, `lock_enabled`, `pick_backup_folder`, `prepare_backup_folder`, `retry_startup`, `set_badge`, `set_lock_enabled`, `share_file`, `startup_failure`, `undo_clear_backup_folder`, `use_import_backup_folder`). No direct `invoke("plugin:...")` call was found.

**Missing grants found:** the separate updater `download` and `install` commands on desktop, plus HTTP URL scope for opener on desktop and iOS. All are included in the targeted capabilities.
