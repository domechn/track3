#[macro_use]
extern crate lazy_static;
use std::collections::HashMap;

use track3::{
    binance::Binance,
    ent::Ent,
    info::get_coin_info_provider,
    migration::{
        init_sqlite_file, init_sqlite_tables, is_first_run, load_previous_version,
        prepare_required_data, Migration, V1TV2, V2TV3, V3TV4,
    },
    okex::Okex,
    types::CoinWithPrice,
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
        Ok(prices) => {
            // if all value in prices is 0, raise error
            // fix issue: https://github.com/domechn/track3/issues/257
            let mut is_all_zero = true;
            for (_, v) in prices.iter() {
                if *v != 0.0 {
                    is_all_zero = false;
                    break;
                }
            }

            if is_all_zero {
                return Err("get coin prices failed: all prices are 0".to_string());
            }
            return Ok(prices);
        }
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
    coins: Vec<CoinWithPrice>,
) -> Result<(), String> {
    let resource_dir = handle
        .path_resolver()
        .app_cache_dir()
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
    let client = get_coin_info_provider();

    let res = client.download_coins_logos(coins, resource_dir).await;

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
            let app_dir_str = app_dir.to_str().unwrap().to_string();
            let resource_dir_str = resource_dir.to_str().unwrap().to_string();

            let v1tv2 = V1TV2::new(app_dir_str.clone(), resource_dir_str.clone());
            let v2tv3 = V2TV3::new(app_dir_str.clone(), resource_dir_str.clone());
            let v3tv4 = V3TV4::new(app_dir_str.clone(), resource_dir_str.clone());

            let pv = load_previous_version(app_dir.as_path()).unwrap();
            if v1tv2.need_to_run(&pv).unwrap() {
                v1tv2.migrate();
            }

            if v2tv3.need_to_run(&pv).unwrap() {
                v2tv3.migrate();
            }

            if v3tv4.need_to_run(&pv).unwrap() {
                v3tv4.migrate();
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
            download_coins_logos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
