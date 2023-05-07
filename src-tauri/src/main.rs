use std::{collections::HashMap, path::Path, process};

use tauri::api::process::{Command, CommandEvent};
use track3::price::{get_price_querier};

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

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let resource_path = app.path_resolver();
            let app_dir = resource_path.app_data_dir().unwrap();
            println!("app_dir: {:?}", app_dir);

            if is_first_run(app_dir.as_path()) {
                init_resources(app_dir.as_path());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![query_coins_prices])
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

fn init_resources(path: &Path) {
    println!("init resources in rust");
    let (mut rx, mut _child) = Command::new_sidecar("track3-loader")
        .expect("failed to create `track3-loader` binary command")
        .args(&["-c", "init", "-d", path.join("track3.db").to_str().unwrap()])
        .spawn()
        .expect("failed to spawn sidecar");

    tauri::async_runtime::spawn(async move {
        // read events such as stdout
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Stdout(line) = event {
                println!("init stdout: {}", line);
            } else if let CommandEvent::Stderr(line) = event {
                println!("init stderr: {}", line);
                process::exit(1);
            }
        }
    });
}
