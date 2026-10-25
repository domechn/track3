#[cfg(debug_assertions)]
use std::io::Write;
#[cfg(target_os = "ios")]
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use std::{collections::HashMap, io};

use crate::{
    binance::Binance,
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
        delete_sync_snapshot as delete_sync_snapshot_atomically,
        import_sync_snapshot as import_sync_snapshot_atomically,
        replace_sync_snapshot as replace_sync_snapshot_atomically,
    },
    types::{CoinWithPrice, RefreshAssetInput, RefreshTransactionInput},
};
use tauri::Manager;

lazy_static! {
    static ref ENT: Ent = Ent::new();
}
#[cfg(target_os = "ios")]
static IOS_STARTUP_FAILURE: Mutex<Option<String>> = Mutex::new(None);
#[cfg(target_os = "ios")]
static IOS_STARTUP_RETRYABLE: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "ios")]
fn set_ios_startup_failure(error: String, retryable: bool) {
    *IOS_STARTUP_FAILURE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(error);
    IOS_STARTUP_RETRYABLE.store(retryable, Ordering::SeqCst);
}

/// Decrypt data with an explicit key (for import where the current ENT key
/// does not match the one used during export).
#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[tauri::command]
fn decrypt_with_key(data: String, key: String) -> Result<String, String> {
    match ENT.decrypt_with_key(data, &key) {
        Ok(decrypted) => Ok(decrypted),
        Err(e) => Err(format!("{}", e)),
    }
}

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
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

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[tauri::command]
async fn persist_refresh(
    database_path: tauri::State<'_, DatabasePath>,
    operation_uuid: String,
    created_at: String,
    assets: Vec<RefreshAssetInput>,
    txns: Vec<RefreshTransactionInput>,
) -> Result<(), String> {
    persist_refresh_atomically(
        &database_path.0,
        &operation_uuid,
        &created_at,
        &assets,
        &txns,
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
async fn delete_sync_snapshot(
    database_path: tauri::State<'_, DatabasePath>,
    uuid: String,
) -> Result<(), String> {
    delete_sync_snapshot_atomically(&database_path.0, &uuid).await
}

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[tauri::command]
async fn query_binance_balance(
    api_key: String,
    api_secret: String,
) -> Result<HashMap<String, f64>, String> {
    let b = Binance::new(api_key.clone(), api_secret.clone());
    let res = b.query_balance().await;
    match res {
        Ok(balances) => Ok(balances),
        Err(e) => {
            let mut message = sanitize_upstream_error(&e.to_string());
            for secret in [&api_key, &api_secret] {
                if !secret.is_empty() {
                    message = message.replace(secret, "<REDACTED>");
                }
            }
            Err(message)
        }
    }
}

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
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

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[tauri::command]
async fn download_coins_logos(
    handle: tauri::AppHandle,
    coins: Vec<CoinWithPrice>,
) -> Result<(), String> {
    let resource_dir = handle
        .path()
        .app_cache_dir()
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
    let client = get_coin_info_provider();

    let res = client.download_coins_logos(coins, resource_dir).await;

    match res {
        Ok(_) => Ok(()),
        Err(e) => Err(sanitize_upstream_error(&e.to_string())),
    }
}

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[tauri::command]
fn encrypt(data: String) -> Result<String, String> {
    let res = ENT.encrypt(data);
    match res {
        Ok(encrypted) => Ok(encrypted),
        Err(e) => Err(format!("encrypt error: {:?}", e)),
    }
}

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[tauri::command]
fn decrypt(data: String) -> Result<String, String> {
    // Sessions written before a user-specific key existed stay readable.
    let res = ENT.decrypt_with_fallback(data, LEGACY_ENCRYPTION_KEY);
    match res {
        Ok(encrypted) => Ok(encrypted),
        Err(e) => Err(format!("decrypt error: {:?}", e)),
    }
}

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[tauri::command]
fn get_database_url(database_path: tauri::State<'_, DatabasePath>) -> Result<String, String> {
    sqlite_url(&database_path.0)
}

#[tauri::command]
fn ios_startup_failure() -> Option<String> {
    #[cfg(target_os = "ios")]
    return IOS_STARTUP_FAILURE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone();
    #[cfg(not(target_os = "ios"))]
    None
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

#[cfg(not(target_os = "ios"))]
#[tauri::command]
fn ios_retry_startup() -> bool {
    false
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

#[cfg(not(target_os = "ios"))]
#[tauri::command]
fn ios_key_recovery_needed() -> bool {
    false
}

#[tauri::command]
fn ios_lock_enabled() -> bool {
    #[cfg(target_os = "ios")]
    {
        crate::ios_native::lock_enabled()
    }
    #[cfg(not(target_os = "ios"))]
    {
        false
    }
}

#[tauri::command]
fn ios_set_lock_enabled(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        crate::ios_native::set_lock_enabled(enabled);
        Ok(())
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = enabled;
        Err("iOS only".into())
    }
}

#[tauri::command]
async fn ios_authenticate() -> Result<bool, String> {
    #[cfg(target_os = "ios")]
    {
        tauri::async_runtime::spawn_blocking(crate::ios_native::authenticate)
            .await
            .map_err(|_| "authentication failed".to_string())
    }
    #[cfg(not(target_os = "ios"))]
    {
        Err("iOS only".into())
    }
}

#[tauri::command]
fn ios_haptic(kind: String) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        crate::ios_native::haptic(&kind)
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = kind;
        Err("iOS only".into())
    }
}

#[tauri::command]
fn ios_set_badge(count: i32) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        crate::ios_native::set_badge(count);
        Ok(())
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = count;
        Err("iOS only".into())
    }
}

#[tauri::command]
fn ios_share_file(handle: tauri::AppHandle, path: String) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        crate::ios_native::share_file(&handle, &path)
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = (handle, path);
        Err("iOS only".into())
    }
}

#[cfg(debug_assertions)]
#[tauri::command]
fn mark_frontend_ready(handle: tauri::AppHandle) -> Result<(), String> {
    let cache_dir = handle.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    std::fs::write(cache_dir.join("track3-ready"), b"track3:ready").map_err(|e| e.to_string())
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
    #[cfg(not(mobile))]
    let builder = builder.plugin(tauri_plugin_sql::Builder::default().build());
    let builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init());
    let builder = builder.setup(|app| {
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
            #[cfg(target_os = "ios")]
            app.manage(DatabasePath(database_path));
            Ok(())
        })();
        #[cfg(debug_assertions)]
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
    #[cfg(debug_assertions)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        query_coins_prices,
        query_binance_balance,
        encrypt,
        decrypt,
        download_coins_logos,
        decrypt_with_key,
        rotate_encryption_key,
        persist_refresh,
        import_sync_snapshot,
        replace_sync_snapshot,
        delete_sync_snapshot,
        get_database_url,
        ios_key_recovery_needed,
        ios_startup_failure,
        ios_retry_startup,
        ios_lock_enabled,
        ios_set_lock_enabled,
        ios_authenticate,
        ios_haptic,
        ios_set_badge,
        ios_share_file,
        mark_frontend_ready,
        record_frontend_error,
    ]);
    #[cfg(not(debug_assertions))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        query_coins_prices,
        query_binance_balance,
        encrypt,
        decrypt,
        download_coins_logos,
        decrypt_with_key,
        rotate_encryption_key,
        persist_refresh,
        import_sync_snapshot,
        replace_sync_snapshot,
        delete_sync_snapshot,
        get_database_url,
        ios_key_recovery_needed,
        ios_startup_failure,
        ios_retry_startup,
        ios_lock_enabled,
        ios_set_lock_enabled,
        ios_authenticate,
        ios_haptic,
        ios_set_badge,
        ios_share_file,
    ]);
    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
