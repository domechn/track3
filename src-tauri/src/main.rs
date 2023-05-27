#[macro_use]
extern crate lazy_static;
use std::{
    collections::HashMap,
    fs::{self, File},
    path::Path,
};

use sqlx::{Connection, Executor, SqliteConnection};
use tauri::Manager;
use tokio::runtime::Runtime;
use track3::{binance::Binance, ent::Ent, okex::Okex, price::get_price_querier};

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
    .hidden_title(true)
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

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let resource_path = app.path_resolver();
            let resource_dir = resource_path.resource_dir().unwrap();
            let app_dir = resource_path.app_data_dir().unwrap();
            println!("app_dir: {:?}, resource_dir: {:?}", app_dir, resource_dir);

            if is_first_run(app_dir.as_path()) {
                init_resources(app_dir.as_path(), resource_dir.as_path());
            }
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
        ])
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn is_first_run(path: &Path) -> bool {
    // check sqlite file exists
    if path.join("track3.db").exists() {
        false
    } else {
        true
    }
}

fn init_resources(app_dir: &Path, resource_dir: &Path) {
    println!("init resources in rust");
    let sqlite_path = String::from(app_dir.join("track3.db").to_str().unwrap());
    File::create(&sqlite_path).unwrap();

    let assets = fs::read_to_string(resource_dir.join("migrations/init/assets_up.sql")).unwrap();
    let configuration =
        fs::read_to_string(resource_dir.join("migrations/init/configuration_up.sql")).unwrap();

    let rt = Runtime::new().unwrap();
    rt.block_on(async move {
        println!("init resources in tokio spawn");
        let mut conn = SqliteConnection::connect(&sqlite_path).await.unwrap();
        conn.execute(assets.as_str()).await.unwrap();
        conn.execute(configuration.as_str()).await.unwrap();
        conn.close().await.unwrap();
        println!("init resources in tokio spawn done");
    });
}
