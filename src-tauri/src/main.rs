#[macro_use]
extern crate lazy_static;
use std::{collections::HashMap, fs};
use tauri_plugin_aptabase::EventTracker;

use tauri::Manager;
use track3::{
    binance::Binance,
    ent::Ent,
    migration::{
        init_sqlite_file, init_sqlite_tables, is_first_run, is_from_v01_to_v02, is_from_v02_to_v03,
        migrate_from_v01_to_v02, migrate_from_v02_to_v03, prepare_required_data,
    },
    okex::Okex,
    price::get_price_querier,
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
    let client = get_price_querier();
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
async fn open_debank_window_in_background(handle: tauri::AppHandle, address: String) {
    let debank_window = tauri::WindowBuilder::new(
        &handle,
        "debank-refresh", /* the unique window label */
        tauri::WindowUrl::External(
            format!("https://debank.com/profile/{address}") // eth contract address
                .parse()
                .unwrap(),
        ),
    )
    .inner_size(0.0, 0.0)
    .build();

    if let Ok(debank_window) = debank_window {
        debank_window.hide().unwrap();
    }
}

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[tauri::command]
async fn close_debank_window(handle: tauri::AppHandle) {
    // get window
    let debank_window = handle.get_window("debank-refresh");
    if let Some(debank_window) = debank_window {
        debank_window.close().unwrap();
    }
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
                init_sqlite_tables(app_dir.as_path(), resource_dir.as_path());
            }

            if is_from_v01_to_v02(app_dir.as_path()).unwrap() {
                // upgrade from v0.1 to v0.2
                migrate_from_v01_to_v02(app_dir.as_path(), resource_dir.as_path());
            }

            if is_from_v02_to_v03(app_dir.as_path()).unwrap() {
                migrate_from_v02_to_v03(app_dir.as_path(), resource_dir.as_path());
            }

            prepare_required_data(app_version, app_dir.as_path());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            query_coins_prices,
            query_binance_balance,
            query_okex_balance,
            encrypt,
            decrypt,
            open_debank_window_in_background,
            close_debank_window,
            get_polybase_namespace,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
