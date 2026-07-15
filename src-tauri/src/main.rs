#[macro_use]
extern crate lazy_static;
use std::{collections::HashMap, io};

use tauri::Manager;
use track3::{
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
    startup_security::{acquire_app_instance_lock, load_encryption_key},
    types::{CoinWithPrice, RefreshAssetInput, RefreshTransactionInput},
};

lazy_static! {
    static ref ENT: Ent = Ent::new();
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

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[tauri::command]
async fn query_binance_balance(
    api_key: String,
    api_secret: String,
) -> Result<HashMap<String, f64>, String> {
    let b = Binance::new(api_key, api_secret);
    let res = b.query_balance().await;
    match res {
        Ok(balances) => Ok(balances),
        Err(e) => Err(sanitize_upstream_error(&e.to_string())),
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
    let res = ENT.decrypt(data);
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        // .plugin(tauri_plugin_context_menu::init())
        .setup(|app| {
            let app_version = app.package_info().version.to_string();
            let resource_path = app.path();
            let resource_dir = resource_path.resource_dir()?;
            let app_data_dir = resource_path.app_data_dir()?;
            let app_config_dir = resource_path.app_config_dir()?;
            let instance_lock =
                acquire_app_instance_lock(&app_data_dir).map_err(io::Error::other)?;
            app.manage(instance_lock);
            let database_path = tauri::async_runtime::block_on(resolve_database_path(
                &app_data_dir,
                &app_config_dir,
            ))
            .map_err(io::Error::other)?;
            tauri::async_runtime::block_on(initialize_database_if_needed(
                &database_path,
                &app_version,
                &resource_dir,
            ))
            .map_err(io::Error::other)?;
            app.manage(DatabasePath(database_path.clone()));
            println!(
                "database_path: {:?}, resource_dir: {:?}",
                database_path, resource_dir
            );

            let key_path = app_data_dir.join(".ent-key");
            let enc_key = load_encryption_key(&key_path).map_err(io::Error::other)?;
            ENT.set_key(enc_key).map_err(io::Error::other)?;

            tauri::async_runtime::block_on(recover_pending_rotation(
                &database_path,
                &app_data_dir,
                &ENT,
            ))
            .map_err(io::Error::other)?;

            tauri::async_runtime::block_on(run_migrations(
                &database_path,
                &resource_dir,
                &app_version,
            ))
            .map_err(io::Error::other)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            query_coins_prices,
            query_binance_balance,
            encrypt,
            decrypt,
            download_coins_logos,
            decrypt_with_key,
            rotate_encryption_key,
            persist_refresh,
            get_database_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
