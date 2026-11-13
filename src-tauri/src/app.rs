#[cfg(debug_assertions)]
use std::io::Write;
#[cfg(target_os = "ios")]
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use std::{collections::HashMap, io, path::Path};

#[cfg(not(target_os = "ios"))]
use crate::key_rotation::reset_encryption_key_for_command as reset_encryption_key_recoverably;
use crate::{
    database_path::{
        initialize_database_if_needed, resolve_database_path, sqlite_url, DatabasePath,
    },
    ent::Ent,
    info::{get_coin_info_provider, sanitize_upstream_error, validate_coin_prices},
    key_rotation::{
        recover_pending_rotation,
        rotate_encryption_key_for_command as rotate_encryption_key_recoverably,
        RotationCommandError,
    },
    migration::run_migrations,
    refresh_persistence::persist_refresh as persist_refresh_atomically,
    startup_security::{acquire_app_instance_lock, LEGACY_ENCRYPTION_KEY},
    sync_persistence::{
        delete_local_snapshot as delete_local_snapshot_atomically,
        delete_sync_snapshot as delete_sync_snapshot_atomically,
        import_sync_snapshot as import_sync_snapshot_atomically,
        replace_import_snapshot as replace_import_snapshot_atomically,
        replace_sync_snapshot as replace_sync_snapshot_atomically,
        restore_local_snapshot as restore_local_snapshot_atomically,
        save_sync_state as save_sync_state_atomically, SnapshotStateRow,
    },
    types::{RefreshAssetInput, RefreshTransactionInput},
};
#[cfg(not(target_os = "ios"))]
use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection};
use tauri::Manager;
use tauri_plugin_fs::FsExt;

lazy_static! {
    static ref ENT: Ent = Ent::new();
}
#[cfg(target_os = "ios")]
static IOS_STARTUP_FAILURE: Mutex<Option<String>> = Mutex::new(None);
#[cfg(target_os = "ios")]
static IOS_STARTUP_RETRYABLE: AtomicBool = AtomicBool::new(false);
#[cfg(target_os = "ios")]
static IOS_BACKUP_FOLDER_FAILURE: Mutex<Option<String>> = Mutex::new(None);

#[cfg(target_os = "ios")]
fn set_ios_startup_failure(error: String, retryable: bool) {
    *IOS_STARTUP_FAILURE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(error);
    IOS_STARTUP_RETRYABLE.store(retryable, Ordering::SeqCst);
}

/// Decrypt data with an explicit key (for import where the current ENT key
/// does not match the one used during export).
#[tauri::command]
fn decrypt_with_key(data: String, key: String) -> Result<String, String> {
    match ENT.decrypt_with_key(data, &key) {
        Ok(decrypted) => Ok(decrypted),
        Err(e) => Err(format!("{}", e)),
    }
}

#[cfg(not(target_os = "ios"))]
#[tauri::command]
fn encryption_key_status() -> Result<bool, String> {
    Ok(ENT.current_key()? != LEGACY_ENCRYPTION_KEY)
}

#[tauri::command]
fn encrypt_export_with_passphrase(data: String, passphrase: String) -> Result<String, String> {
    ENT.encrypt_export_with_passphrase(data, &passphrase)
        .map_err(|_| "failed to encrypt export".to_string())
}

#[tauri::command]
fn decrypt_export_with_passphrase(data: String, passphrase: String) -> Result<String, String> {
    ENT.decrypt_export_with_passphrase(&data, &passphrase)
        .map_err(|_| "incorrect passphrase or invalid export".to_string())
}

#[tauri::command]
async fn rotate_encryption_key(
    handle: tauri::AppHandle,
    database_path: tauri::State<'_, DatabasePath>,
    new_key: String,
) -> Result<(), RotationCommandError> {
    let app_dir = handle
        .path()
        .app_data_dir()
        .map_err(|error| RotationCommandError::Failed {
            message: format!("failed to resolve application data directory: {error}"),
        })?;
    let database_path = database_path.0.clone();
    rotate_encryption_key_recoverably(&database_path, &app_dir, &ENT, new_key).await
}

#[cfg(not(target_os = "ios"))]
#[tauri::command]
async fn reset_encryption_key(
    handle: tauri::AppHandle,
    database_path: tauri::State<'_, DatabasePath>,
) -> Result<(), RotationCommandError> {
    let app_dir = handle
        .path()
        .app_data_dir()
        .map_err(|error| RotationCommandError::Failed {
            message: format!("failed to resolve application data directory: {error}"),
        })?;
    reset_encryption_key_recoverably(&database_path.0, &app_dir, &ENT).await
}

#[tauri::command]
async fn persist_refresh(
    database_path: tauri::State<'_, DatabasePath>,
    operation_uuid: String,
    created_at: String,
    assets: Vec<RefreshAssetInput>,
    txns: Vec<RefreshTransactionInput>,
    partial: Option<serde_json::Value>,
) -> Result<(), String> {
    persist_refresh_atomically(
        &database_path.0,
        &operation_uuid,
        &created_at,
        &assets,
        &txns,
        partial,
    )
    .await
}

#[tauri::command]
async fn import_sync_snapshot(
    database_path: tauri::State<'_, DatabasePath>,
    snapshot: serde_json::Value,
) -> Result<bool, String> {
    import_sync_snapshot_atomically(&database_path.0, snapshot).await
}

#[tauri::command]
async fn replace_sync_snapshot(
    database_path: tauri::State<'_, DatabasePath>,
    snapshot: serde_json::Value,
) -> Result<(), String> {
    replace_sync_snapshot_atomically(&database_path.0, snapshot).await
}

#[tauri::command]
async fn replace_import_snapshot(
    database_path: tauri::State<'_, DatabasePath>,
    snapshot: serde_json::Value,
) -> Result<(), String> {
    replace_import_snapshot_atomically(&database_path.0, snapshot).await
}

#[tauri::command]
async fn delete_sync_snapshot(
    database_path: tauri::State<'_, DatabasePath>,
    uuid: String,
) -> Result<(), String> {
    delete_sync_snapshot_atomically(&database_path.0, &uuid).await
}

#[tauri::command]
async fn update_local_transaction_price(
    database_path: tauri::State<'_, DatabasePath>,
    id: i64,
    price: f64,
) -> Result<(), String> {
    crate::edit_log::update_transaction_price(&database_path.0, id, price).await
}

#[tauri::command]
async fn update_local_transaction_type(
    database_path: tauri::State<'_, DatabasePath>,
    id: i64,
    txn_type: String,
) -> Result<(), String> {
    crate::edit_log::update_transaction_type(&database_path.0, id, &txn_type).await
}

#[tauri::command]
async fn delete_local_asset(
    database_path: tauri::State<'_, DatabasePath>,
    id: i64,
) -> Result<serde_json::Value, String> {
    crate::edit_log::delete_local_asset(&database_path.0, id).await
}

#[tauri::command]
async fn restore_local_asset(
    database_path: tauri::State<'_, DatabasePath>,
    backup: serde_json::Value,
) -> Result<(), String> {
    crate::edit_log::restore_local_asset(&database_path.0, backup).await
}

#[tauri::command]
async fn delete_local_snapshot(
    database_path: tauri::State<'_, DatabasePath>,
    uuid: String,
) -> Result<(), String> {
    delete_local_snapshot_atomically(&database_path.0, &uuid).await
}

#[tauri::command]
async fn restore_local_snapshot(
    database_path: tauri::State<'_, DatabasePath>,
    snapshot: serde_json::Value,
    orphan_transactions: serde_json::Value,
) -> Result<(), String> {
    restore_local_snapshot_atomically(&database_path.0, snapshot, orphan_transactions).await
}

#[tauri::command]
async fn save_sync_state(
    database_path: tauri::State<'_, DatabasePath>,
    data: String,
    rows: Vec<SnapshotStateRow>,
    deleted_ids: Vec<String>,
    clear_snapshots: bool,
) -> Result<(), String> {
    save_sync_state_atomically(
        &database_path.0,
        &data,
        &rows,
        &deleted_ids,
        clear_snapshots,
    )
    .await
}

#[tauri::command]
async fn query_coins_prices(symbols: Vec<String>) -> Result<HashMap<String, f64>, String> {
    let client = get_coin_info_provider();
    // push "USDT" into symbols if not exists
    let symbols = if symbols.contains(&"USDT".to_string()) {
        symbols
    } else {
        let mut symbols = symbols;
        symbols.push("USDT".to_string());
        symbols
    };

    // let client = client.lock().unwrap();
    let res = client.query_coins_prices(symbols).await;

    match res {
        Ok(prices) => validate_coin_prices(prices),
        Err(e) => Err(sanitize_upstream_error(&e.to_string())),
    }
}

#[tauri::command]
fn encrypt(data: String) -> Result<String, String> {
    let res = ENT.encrypt(data);
    match res {
        Ok(encrypted) => Ok(encrypted),
        Err(e) => Err(format!("encrypt error: {:?}", e)),
    }
}

#[tauri::command]
fn decrypt(data: String) -> Result<String, String> {
    // Sessions written before a user-specific key existed stay readable.
    let res = ENT.decrypt_with_fallback(data, LEGACY_ENCRYPTION_KEY);
    match res {
        Ok(encrypted) => Ok(encrypted),
        Err(e) => Err(format!("decrypt error: {:?}", e)),
    }
}

#[tauri::command]
fn get_database_url(database_path: tauri::State<'_, DatabasePath>) -> Result<String, String> {
    sqlite_url(&database_path.0)
}

#[cfg(target_os = "ios")]
#[tauri::command]
fn ios_startup_failure() -> Option<String> {
    IOS_STARTUP_FAILURE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone()
}

#[cfg(target_os = "ios")]
fn retry_ios_startup(handle: tauri::AppHandle) -> Result<(), (String, bool)> {
    let app_version = handle.package_info().version.to_string();
    let resource_dir = handle
        .path()
        .resource_dir()
        .map_err(|error| (error.to_string(), false))?;
    let app_data_dir = handle
        .path()
        .app_data_dir()
        .map_err(|error| (error.to_string(), false))?;
    let app_config_dir = handle
        .path()
        .app_config_dir()
        .map_err(|error| (error.to_string(), false))?;
    let database_path =
        tauri::async_runtime::block_on(resolve_database_path(&app_data_dir, &app_config_dir))
            .map_err(|error| (error, false))?;
    let key = crate::startup_security::load_or_create_ios_encryption_key(
        &app_data_dir.join(".ent-key"),
        !database_path.exists(),
    )
    .map_err(|error| (error, true))?;
    tauri::async_runtime::block_on(initialize_database_if_needed(
        &database_path,
        &app_version,
        &resource_dir,
    ))
    .map_err(|error| (error, false))?;
    ENT.set_key(key).map_err(|error| (error, false))?;
    tauri::async_runtime::block_on(recover_pending_rotation(
        &database_path,
        &app_data_dir,
        &ENT,
    ))
    .map_err(|error| (error, false))?;
    crate::ios_backup::exclude_existing_key_artifacts(&app_data_dir)
        .map_err(|error| (error, false))?;
    tauri::async_runtime::block_on(run_migrations(&database_path, &resource_dir, &app_version))
        .map_err(|error| (error, false))?;
    handle.manage(DatabasePath(database_path));
    Ok(())
}

#[cfg(target_os = "ios")]
#[tauri::command]
async fn ios_retry_startup(handle: tauri::AppHandle) -> Result<bool, String> {
    if !IOS_STARTUP_RETRYABLE.swap(false, Ordering::SeqCst) {
        return Ok(false);
    }
    match tauri::async_runtime::spawn_blocking(move || retry_ios_startup(handle)).await {
        Ok(Ok(())) => {
            *IOS_STARTUP_FAILURE
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
            Ok(true)
        }
        Ok(Err((error, retryable))) => {
            set_ios_startup_failure(error, retryable);
            Ok(false)
        }
        Err(error) => {
            set_ios_startup_failure(format!("startup retry failed: {error}"), false);
            Ok(false)
        }
    }
}

#[cfg(target_os = "ios")]
#[tauri::command]
async fn ios_key_recovery_needed(
    handle: tauri::AppHandle,
    database_path: tauri::State<'_, DatabasePath>,
) -> Result<bool, String> {
    let app_dir = handle.path().app_data_dir().map_err(|e| e.to_string())?;
    crate::startup_security::ios_key_recovery_needed(&database_path.0, &app_dir.join(".ent-key"))
        .await
}

#[cfg(target_os = "ios")]
#[tauri::command]
fn ios_lock_enabled() -> bool {
    crate::ios_native::lock_enabled()
}

#[cfg(target_os = "ios")]
#[tauri::command]
fn ios_auto_retry_allowed() -> bool {
    crate::ios_native::auto_retry_allowed()
}

#[cfg(target_os = "ios")]
#[tauri::command]
fn ios_set_lock_enabled(enabled: bool) -> Result<(), String> {
    crate::ios_native::set_lock_enabled(enabled);
    Ok(())
}

#[cfg(target_os = "ios")]
#[tauri::command]
async fn ios_authenticate() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(crate::ios_native::authenticate)
        .await
        .map_err(|_| "authentication failed".to_string())
}

#[cfg(target_os = "ios")]
#[tauri::command]
fn ios_haptic(kind: String) -> Result<(), String> {
    crate::ios_native::haptic(&kind)
}

#[cfg(target_os = "ios")]
#[tauri::command]
fn ios_set_badge(count: i32) -> Result<(), String> {
    crate::ios_native::set_badge(count);
    Ok(())
}

#[cfg(target_os = "ios")]
#[tauri::command]
fn ios_share_file(handle: tauri::AppHandle, path: String) -> Result<(), String> {
    crate::ios_native::share_file(&handle, &path)
}

#[cfg(target_os = "ios")]
fn allow_backup_folder(handle: &tauri::AppHandle, path: &str) -> Result<(), String> {
    let selected = std::path::Path::new(path);
    handle
        .fs_scope()
        .allow_directory(selected, true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(target_os = "ios"))]
async fn grant_saved_backup_folder(
    handle: &tauri::AppHandle,
    database_path: &Path,
) -> Result<(), String> {
    let options = SqliteConnectOptions::new()
        .filename(database_path)
        .read_only(true);
    let mut database = SqliteConnection::connect_with(&options)
        .await
        .map_err(|error| error.to_string())?;
    let folder: Option<String> = sqlx::query_scalar("SELECT data FROM configuration WHERE id = 3")
        .fetch_optional(&mut database)
        .await
        .map_err(|error| error.to_string())?;
    database.close().await.map_err(|error| error.to_string())?;
    if let Some(folder) = folder {
        let path = Path::new(&folder);
        if path.is_dir() {
            handle
                .fs_scope()
                .allow_directory(path, true)
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[cfg(target_os = "ios")]
#[tauri::command]
async fn ios_pick_backup_folder(
    handle: tauri::AppHandle,
    kind: String,
) -> Result<Option<String>, String> {
    let kind = crate::ios_backup_path::backup_folder_kind(&kind).map_err(|e| e.to_string())?;
    let selected =
        tauri::async_runtime::spawn_blocking(move || crate::ios_native::pick_backup_folder(kind))
            .await
            .map_err(|e| e.to_string())??;
    if let Some(path) = &selected {
        allow_backup_folder(&handle, path)?;
        if kind == 0 {
            *IOS_BACKUP_FOLDER_FAILURE
                .lock()
                .unwrap_or_else(|p| p.into_inner()) = None;
        }
    }
    Ok(selected)
}

#[cfg(target_os = "ios")]
#[tauri::command]
fn ios_backup_folder_status(handle: tauri::AppHandle) -> IOSBackupFolderStatus {
    let path = match crate::ios_native::restore_backup_folder(0) {
        Ok(path) => {
            if let Some(path) = &path {
                if let Err(error) = allow_backup_folder(&handle, path) {
                    *IOS_BACKUP_FOLDER_FAILURE
                        .lock()
                        .unwrap_or_else(|p| p.into_inner()) = Some(error);
                }
            }
            path
        }
        Err(error) => {
            *IOS_BACKUP_FOLDER_FAILURE
                .lock()
                .unwrap_or_else(|p| p.into_inner()) = Some(error);
            None
        }
    };
    let failure = IOS_BACKUP_FOLDER_FAILURE
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    IOSBackupFolderStatus { path, failure }
}

#[cfg(target_os = "ios")]
#[derive(serde::Serialize)]
struct IOSBackupFolderStatus {
    path: Option<String>,
    failure: Option<String>,
}

#[cfg(target_os = "ios")]
#[tauri::command]
fn ios_use_import_backup_folder(handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let selected = crate::ios_native::restore_backup_folder(1)?
        .ok_or("Import folder is unavailable. Choose it again.")?;
    let selected_path = std::path::Path::new(&selected)
        .canonicalize()
        .map_err(|_| "Import folder is unavailable. Choose it again.")?;
    let requested_path = std::path::Path::new(&path)
        .canonicalize()
        .map_err(|_| "Import folder is unavailable. Choose it again.")?;
    if crate::ios_backup_path::backup_parent(&selected_path).is_some()
        || selected_path != requested_path
    {
        return Err("Choose the parent folder containing track3-backup for auto backup.".into());
    }
    crate::ios_native::use_import_backup_folder()?;
    allow_backup_folder(&handle, &path)?;
    *IOS_BACKUP_FOLDER_FAILURE
        .lock()
        .unwrap_or_else(|p| p.into_inner()) = None;
    Ok(())
}

#[cfg(target_os = "ios")]
#[tauri::command]
fn ios_clear_backup_folder(kind: String) -> Result<(), String> {
    let kind = crate::ios_backup_path::backup_folder_kind(&kind).map_err(|e| e.to_string())?;
    crate::ios_native::clear_backup_folder(kind);
    if kind == 0 {
        *IOS_BACKUP_FOLDER_FAILURE
            .lock()
            .unwrap_or_else(|p| p.into_inner()) = None;
    }
    Ok(())
}

#[cfg(target_os = "ios")]
#[tauri::command]
fn ios_undo_clear_backup_folder(handle: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = crate::ios_native::undo_clear_backup_folder(0)?;
    if let Some(path) = &path {
        allow_backup_folder(&handle, path)?;
    }
    Ok(path)
}

#[cfg(target_os = "ios")]
#[tauri::command]
async fn ios_prepare_backup_folder(
    handle: tauri::AppHandle,
    path: String,
    kind: String,
) -> Result<(), String> {
    let auto = crate::ios_backup_path::backup_folder_kind(&kind).map_err(|e| e.to_string())? == 0;
    let documents = handle.path().document_dir().map_err(|e| e.to_string())?;
    let in_documents =
        crate::ios_backup_path::is_document_location(std::path::Path::new(&path), &documents);
    let result = if !in_documents && !handle.fs_scope().is_allowed(&path) {
        Err("Backup folder is outside allowed Files locations".into())
    } else {
        tauri::async_runtime::spawn_blocking(move || {
            crate::ios_native::prepare_backup_folder(&path)
        })
        .await
        .map_err(|e| e.to_string())?
    };
    if auto {
        *IOS_BACKUP_FOLDER_FAILURE
            .lock()
            .unwrap_or_else(|p| p.into_inner()) = result.as_ref().err().cloned();
    }
    result
}

#[cfg(debug_assertions)]
#[tauri::command]
fn mark_frontend_ready(handle: tauri::AppHandle, width: u32, height: u32) -> Result<(), String> {
    let cache_dir = handle.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    std::fs::write(
        cache_dir.join("track3-ready"),
        format!("track3:ready\n{width}x{height}\n"),
    )
    .map_err(|e| e.to_string())
}

#[cfg(debug_assertions)]
#[tauri::command]
fn record_frontend_error(handle: tauri::AppHandle, message: String) -> Result<(), String> {
    let cache_dir = handle.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    let path = cache_dir.join("track3-frontend-errors.log");
    if path
        .metadata()
        .is_ok_and(|metadata| metadata.len() >= 65536)
    {
        return Ok(());
    }
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "{}", message.chars().take(4000).collect::<String>()).map_err(|e| e.to_string())
}

fn cleanup_cached_coin_logos(cache_dir: &Path) -> io::Result<()> {
    let assets = cache_dir.join("assets");
    let coins = assets.join("coins");
    for path in [&assets, &coins] {
        match std::fs::symlink_metadata(path) {
            Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {}
            Ok(_) => return Ok(()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(()),
            Err(error) => return Err(error),
        }
    }
    std::fs::remove_dir_all(coins)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(not(mobile))]
    let builder = builder.plugin(tauri_plugin_process::init());
    let builder = builder.plugin(tauri_plugin_http::init());
    #[cfg(not(mobile))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    let builder = builder
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_fs::init());
    #[cfg(not(mobile))]
    let builder = builder.plugin(tauri_plugin_shell::init());
    let builder = builder.plugin(tauri_plugin_dialog::init());
    let builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init());
    let builder = builder.setup(|app| {
        match app.path().app_cache_dir() {
            Ok(cache_dir) => {
                tauri::async_runtime::spawn_blocking(move || {
                    match cleanup_cached_coin_logos(&cache_dir) {
                        Ok(()) => log::debug!("Coin icon cache cleanup finished"),
                        Err(error) => log::debug!("Coin icon cache cleanup failed: {error}"),
                    }
                });
            }
            Err(error) => log::debug!("Coin icon cache path unavailable: {error}"),
        }
        let result: Result<(), Box<dyn std::error::Error>> = (|| {
            let app_version = app.package_info().version.to_string();
            let resource_path = app.path();
            let resource_dir = resource_path.resource_dir()?;
            let app_data_dir = resource_path.app_data_dir()?;
            let app_config_dir = resource_path.app_config_dir()?;
            let instance_lock =
                acquire_app_instance_lock(&app_data_dir).map_err(io::Error::other)?;
            app.manage(instance_lock);
            #[cfg(target_os = "ios")]
            crate::ios_native::install();
            #[cfg(target_os = "ios")]
            match crate::ios_native::restore_backup_folder(0) {
                Ok(Some(path)) => {
                    if let Err(error) = allow_backup_folder(app.handle(), &path) {
                        *IOS_BACKUP_FOLDER_FAILURE
                            .lock()
                            .unwrap_or_else(|p| p.into_inner()) = Some(error);
                    }
                }
                Ok(None) => (),
                Err(error) => {
                    *IOS_BACKUP_FOLDER_FAILURE
                        .lock()
                        .unwrap_or_else(|p| p.into_inner()) = Some(error)
                }
            }
            #[cfg(target_os = "ios")]
            if let Ok(Some(path)) = crate::ios_native::restore_backup_folder(1) {
                let _ = allow_backup_folder(app.handle(), &path);
            }
            #[cfg(target_os = "ios")]
            crate::ios_backup::exclude_existing_key_artifacts(&app_data_dir)
                .map_err(io::Error::other)?;
            let database_path = tauri::async_runtime::block_on(resolve_database_path(
                &app_data_dir,
                &app_config_dir,
            ))
            .map_err(io::Error::other)?;
            #[cfg(target_os = "ios")]
            let ios_key = match crate::startup_security::load_or_create_ios_encryption_key(
                &app_data_dir.join(".ent-key"),
                !database_path.exists(),
            ) {
                Ok(key) => key,
                Err(error) => {
                    #[cfg(debug_assertions)]
                    let _ = record_frontend_error(
                        app.handle().clone(),
                        format!("startup key unavailable: {error}"),
                    );
                    set_ios_startup_failure(error, true);
                    return Ok(());
                }
            };
            tauri::async_runtime::block_on(initialize_database_if_needed(
                &database_path,
                &app_version,
                &resource_dir,
            ))
            .map_err(io::Error::other)?;
            #[cfg(not(target_os = "ios"))]
            app.manage(DatabasePath(database_path.clone()));

            #[cfg(not(target_os = "ios"))]
            let enc_key =
                crate::startup_security::load_encryption_key(&app_data_dir.join(".ent-key"))
                    .map_err(io::Error::other)?;
            #[cfg(target_os = "ios")]
            let enc_key = ios_key;
            ENT.set_key(enc_key).map_err(io::Error::other)?;

            tauri::async_runtime::block_on(recover_pending_rotation(
                &database_path,
                &app_data_dir,
                &ENT,
            ))
            .map_err(io::Error::other)?;
            #[cfg(target_os = "ios")]
            crate::ios_backup::exclude_existing_key_artifacts(&app_data_dir)
                .map_err(io::Error::other)?;

            tauri::async_runtime::block_on(run_migrations(
                &database_path,
                &resource_dir,
                &app_version,
            ))
            .map_err(io::Error::other)?;
            #[cfg(not(target_os = "ios"))]
            if let Err(error) = tauri::async_runtime::block_on(grant_saved_backup_folder(
                app.handle(),
                &database_path,
            )) {
                log::warn!("Saved backup folder grant failed: {error}");
            }
            #[cfg(target_os = "ios")]
            app.manage(DatabasePath(database_path));
            Ok(())
        })();
        #[cfg(all(debug_assertions, target_os = "ios"))]
        if let Err(error) = &result {
            let _ = record_frontend_error(app.handle().clone(), format!("startup failed: {error}"));
        }
        #[cfg(target_os = "ios")]
        if let Err(error) = result {
            set_ios_startup_failure(error.to_string(), false);
            return Ok(());
        }
        #[cfg(not(target_os = "ios"))]
        return result;
        #[cfg(target_os = "ios")]
        Ok(())
    });
    #[cfg(all(debug_assertions, target_os = "ios"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        query_coins_prices,
        encrypt,
        decrypt,
        decrypt_with_key,
        encrypt_export_with_passphrase,
        decrypt_export_with_passphrase,
        rotate_encryption_key,
        persist_refresh,
        import_sync_snapshot,
        replace_sync_snapshot,
        replace_import_snapshot,
        delete_sync_snapshot,
        update_local_transaction_price,
        update_local_transaction_type,
        delete_local_asset,
        restore_local_asset,
        delete_local_snapshot,
        restore_local_snapshot,
        save_sync_state,
        get_database_url,
        ios_key_recovery_needed,
        ios_startup_failure,
        ios_retry_startup,
        ios_lock_enabled,
        ios_auto_retry_allowed,
        ios_set_lock_enabled,
        ios_authenticate,
        ios_haptic,
        ios_set_badge,
        ios_share_file,
        ios_pick_backup_folder,
        ios_backup_folder_status,
        ios_use_import_backup_folder,
        ios_clear_backup_folder,
        ios_undo_clear_backup_folder,
        ios_prepare_backup_folder,
        mark_frontend_ready,
        record_frontend_error,
    ]);
    #[cfg(all(not(debug_assertions), target_os = "ios"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        query_coins_prices,
        encrypt,
        decrypt,
        decrypt_with_key,
        encrypt_export_with_passphrase,
        decrypt_export_with_passphrase,
        rotate_encryption_key,
        persist_refresh,
        import_sync_snapshot,
        replace_sync_snapshot,
        replace_import_snapshot,
        delete_sync_snapshot,
        update_local_transaction_price,
        update_local_transaction_type,
        delete_local_asset,
        restore_local_asset,
        delete_local_snapshot,
        restore_local_snapshot,
        save_sync_state,
        get_database_url,
        ios_key_recovery_needed,
        ios_startup_failure,
        ios_retry_startup,
        ios_lock_enabled,
        ios_auto_retry_allowed,
        ios_set_lock_enabled,
        ios_authenticate,
        ios_haptic,
        ios_set_badge,
        ios_share_file,
        ios_pick_backup_folder,
        ios_backup_folder_status,
        ios_use_import_backup_folder,
        ios_clear_backup_folder,
        ios_undo_clear_backup_folder,
        ios_prepare_backup_folder,
    ]);
    #[cfg(all(debug_assertions, not(target_os = "ios")))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        query_coins_prices,
        encrypt,
        decrypt,
        decrypt_with_key,
        encrypt_export_with_passphrase,
        decrypt_export_with_passphrase,
        encryption_key_status,
        reset_encryption_key,
        rotate_encryption_key,
        persist_refresh,
        import_sync_snapshot,
        replace_sync_snapshot,
        replace_import_snapshot,
        delete_sync_snapshot,
        update_local_transaction_price,
        update_local_transaction_type,
        delete_local_asset,
        restore_local_asset,
        delete_local_snapshot,
        restore_local_snapshot,
        save_sync_state,
        get_database_url,
        mark_frontend_ready,
        record_frontend_error,
    ]);
    #[cfg(all(not(debug_assertions), not(target_os = "ios")))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        query_coins_prices,
        encrypt,
        decrypt,
        decrypt_with_key,
        encrypt_export_with_passphrase,
        decrypt_export_with_passphrase,
        encryption_key_status,
        reset_encryption_key,
        rotate_encryption_key,
        persist_refresh,
        import_sync_snapshot,
        replace_sync_snapshot,
        replace_import_snapshot,
        delete_sync_snapshot,
        update_local_transaction_price,
        update_local_transaction_type,
        delete_local_asset,
        restore_local_asset,
        delete_local_snapshot,
        restore_local_snapshot,
        save_sync_state,
        get_database_url,
    ]);
    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod coin_logo_cache_tests {
    use super::*;

    #[test]
    fn cleanup_removes_only_cached_coins_and_skips_symlinks() {
        let cache =
            std::env::temp_dir().join(format!("track3-logo-cache-{}", uuid::Uuid::new_v4()));
        let coins = cache.join("assets/coins");
        std::fs::create_dir_all(&coins).unwrap();
        std::fs::write(coins.join("btc.png"), "old icon").unwrap();
        std::fs::write(cache.join("assets/keep.txt"), "keep").unwrap();
        std::fs::create_dir(cache.join("other")).unwrap();
        std::fs::write(cache.join("other/keep.txt"), "keep").unwrap();

        cleanup_cached_coin_logos(&cache).unwrap();
        assert!(!coins.exists());
        assert!(cache.join("assets/keep.txt").exists());
        assert!(cache.join("other/keep.txt").exists());
        cleanup_cached_coin_logos(&cache).unwrap();

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            let external = cache.join("other");
            symlink(&external, &coins).unwrap();
            cleanup_cached_coin_logos(&cache).unwrap();
            assert!(std::fs::symlink_metadata(&coins)
                .unwrap()
                .file_type()
                .is_symlink());
            assert!(external.join("keep.txt").exists());
            std::fs::remove_file(&coins).unwrap();

            std::fs::remove_file(cache.join("assets/keep.txt")).unwrap();
            std::fs::remove_dir(cache.join("assets")).unwrap();
            symlink(&external, cache.join("assets")).unwrap();
            cleanup_cached_coin_logos(&cache).unwrap();
            assert!(external.join("keep.txt").exists());
        }

        std::fs::remove_dir_all(cache).unwrap();
    }
}
