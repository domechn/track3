#[macro_use]
extern crate lazy_static;
use std::{collections::HashMap, fs};

use tauri::Manager;
use track3::{
    binance::Binance,
    ent::Ent,
    migration::{
        init_sqlite_file, init_sqlite_tables, is_first_run, is_from_v01_to_v02, is_from_v02_to_v03,
        migrate_from_v01_to_v02, migrate_from_v02_to_v03, prepare_required_data,
    },
    okex::Okex,
    info::get_coin_info_provider,
};

lazy_static! {
    static ref ENT: Ent = Ent::new();
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
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[tauri::command]
async fn query_okex_balance(
    api_key: String,
    api_secret: String,
    password: String,
) -> Result<HashMap<String, f64>, String> {
    let o = Okex::new(api_key, api_secret, password);
    let res = o.query_balance().await;
    match res {
        Ok(balances) => Ok(balances),
        Err(e) => Err(e.to_string()),
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
        Ok(prices) => Ok(prices),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[tauri::command]
async fn download_coins_logos(
    handle: tauri::AppHandle,
    symbols: Vec<String>,
) -> Result<(), String> {
    let resource_dir = handle.path_resolver().app_cache_dir().unwrap().to_str().unwrap().to_string();
    let client = get_coin_info_provider();

    let res = client
        .download_coins_logos(symbols, resource_dir)
        .await;

    match res {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
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
fn md5(data: String) -> Result<String, String> {
    let digest = md5::compute(data.as_bytes());
    Ok(format!("{:x}", digest))
}

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[tauri::command]
async fn get_polybase_namespace(handle: tauri::AppHandle) -> Result<String, String> {
    let ns = fs::read_to_string(
        handle
            .path_resolver()
            .resource_dir()
            .unwrap()
            .as_path()
            .join("configs/polybase.namespace"),
    );

    match ns {
        // remove \n
        Ok(ns) => Ok(ns.replace("\n", "")),
        Err(e) => Err(format!("get polybase namespace error: {:?}", e)),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_aptabase::Builder::new("A-EU-6972874637").build())
        .setup(|app| {
            let app_version = app.package_info().version.to_string();
            let resource_path = app.path_resolver();
            let resource_dir = resource_path.resource_dir().unwrap();
            let app_dir = resource_path.app_data_dir().unwrap();
            println!("app_dir: {:?}, resource_dir: {:?}", app_dir, resource_dir);

            if is_first_run(app_dir.as_path()) {
                init_sqlite_file(app_dir.as_path());
                init_sqlite_tables(
                    app_version.clone(),
                    app_dir.as_path(),
                    resource_dir.as_path(),
                );
            }

            if is_from_v01_to_v02(app_dir.as_path()).unwrap() {
                // upgrade from v0.1 to v0.2
                migrate_from_v01_to_v02(app_dir.as_path(), resource_dir.as_path());
            }

            if is_from_v02_to_v03(app_dir.as_path()).unwrap() {
                migrate_from_v02_to_v03(app_dir.as_path(), resource_dir.as_path());
            }

            prepare_required_data(app_version.clone(), app_dir.as_path());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            query_coins_prices,
            query_binance_balance,
            query_okex_balance,
            encrypt,
            decrypt,
            md5,
            get_polybase_namespace,
            download_coins_logos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
