use serde::Deserialize;
use sqlx::{sqlite::SqliteConnectOptions, Connection, Executor, SqliteConnection};
use std::{collections::HashMap, path::Path, time::Duration};

#[derive(Deserialize)]
struct Snapshot {
    uuid: String,
    assets: Vec<Asset>,
    prices: Vec<Price>,
    transactions: Vec<Transaction>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Asset {
    id: i64,
    uuid: String,
    created_at: String,
    #[serde(alias = "asset_type")]
    asset_type: String,
    wallet: Option<String>,
    symbol: String,
    amount: f64,
    value: f64,
    price: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Price {
    uuid: String,
    #[serde(rename = "assetID")]
    asset_id: i64,
    symbol: String,
    price: f64,
    asset_created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Transaction {
    uuid: String,
    #[serde(rename = "assetID")]
    asset_id: i64,
    #[serde(alias = "asset_type")]
    asset_type: String,
    wallet: String,
    symbol: String,
    amount: f64,
    price: f64,
    txn_type: String,
    txn_created_at: String,
    created_at: String,
    updated_at: String,
}

async fn connect(path: &Path) -> Result<SqliteConnection, String> {
    SqliteConnection::connect_with(
        &SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(false)
            .busy_timeout(Duration::from_secs(5)),
    )
    .await
    .map_err(|_| "Failed to open sync database".to_string())
}

pub async fn import_sync_snapshot(
    database_path: &Path,
    value: serde_json::Value,
) -> Result<bool, String> {
    persist_sync_snapshot(database_path, value, false).await
}

pub async fn replace_sync_snapshot(
    database_path: &Path,
    value: serde_json::Value,
) -> Result<(), String> {
    persist_sync_snapshot(database_path, value, true)
        .await
        .map(|_| ())
}

async fn persist_sync_snapshot(
    database_path: &Path,
    value: serde_json::Value,
    replace: bool,
) -> Result<bool, String> {
    let snapshot: Snapshot =
        serde_json::from_value(value).map_err(|_| "Invalid sync snapshot".to_string())?;
    if snapshot.uuid.is_empty()
        || snapshot.assets.iter().any(|row| {
            row.uuid != snapshot.uuid
                || row.id <= 0
                || !row.amount.is_finite()
                || !row.value.is_finite()
                || !row.price.is_finite()
        })
        || snapshot
            .prices
            .iter()
            .any(|row| row.uuid != snapshot.uuid || !row.price.is_finite())
        || snapshot.transactions.iter().any(|row| {
            row.uuid != snapshot.uuid || !row.amount.is_finite() || !row.price.is_finite()
        })
    {
        return Err("Invalid sync snapshot".to_string());
    }
    let mut connection = connect(database_path).await?;
    if connection.execute("BEGIN IMMEDIATE").await.is_err() {
        let _ = connection.close().await;
        return Err("Failed to begin sync import".to_string());
    }
    let result: Result<bool, String> = async {
    let marker = format!("snapshot:{}", snapshot.uuid);
    let exists: i64 = sqlx::query_scalar(
        "SELECT (SELECT COUNT(*) FROM sync_applied_objects WHERE object_key = ?)
              + (SELECT COUNT(*) FROM assets_v2 WHERE uuid = ?)
              + (SELECT COUNT(*) FROM transactions WHERE uuid = ?)",
    )
    .bind(&marker)
    .bind(&snapshot.uuid)
    .bind(&snapshot.uuid)
    .fetch_one(&mut connection)
    .await
    .map_err(|_| "Failed to inspect sync snapshot".to_string())?;
    if exists > 0 && !replace {
        return Ok(false);
    }
    if replace && exists == 0 {
        return Err("Cannot edit missing sync snapshot".to_string());
    }
    if replace {
        for table in ["asset_prices", "transactions", "assets_v2"] {
            sqlx::query(&format!("DELETE FROM {table} WHERE uuid = ?"))
                .bind(&snapshot.uuid)
                .execute(&mut connection)
                .await
                .map_err(|_| "Failed to replace sync snapshot".to_string())?;
        }
        sqlx::query("DELETE FROM sync_applied_objects WHERE object_key = ?")
            .bind(&marker)
            .execute(&mut connection)
            .await
            .map_err(|_| "Failed to replace sync snapshot".to_string())?;
    }
    let mut asset_ids = HashMap::new();
    for asset in &snapshot.assets {
        let result = sqlx::query(
            "INSERT INTO assets_v2
             (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&asset.uuid)
        .bind(&asset.created_at)
        .bind(asset.wallet.as_deref().unwrap_or(""))
        .bind(&asset.asset_type)
        .bind(&asset.symbol)
        .bind(asset.amount)
        .bind(asset.value)
        .bind(asset.price)
        .execute(&mut connection)
        .await
        .map_err(|_| "Failed to insert sync asset".to_string())?;
        if asset_ids
            .insert(asset.id, result.last_insert_rowid())
            .is_some()
        {
            return Err("Duplicate sync asset id".to_string());
        }
    }
    for price in &snapshot.prices {
        let Some(asset_id) = asset_ids.get(&price.asset_id) else {
            continue;
        };
        sqlx::query(
            "INSERT INTO asset_prices
             (uuid, assetID, symbol, price, assetCreatedAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&price.uuid)
        .bind(asset_id)
        .bind(&price.symbol)
        .bind(price.price)
        .bind(&price.asset_created_at)
        .bind(&price.updated_at)
        .execute(&mut connection)
        .await
        .map_err(|_| "Failed to insert sync price".to_string())?;
    }
    for row in &snapshot.transactions {
        let asset_id = asset_ids
            .get(&row.asset_id)
            .ok_or_else(|| "Invalid sync transaction asset".to_string())?;
        sqlx::query(
            "INSERT INTO transactions
             (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&row.uuid)
        .bind(asset_id)
        .bind(&row.asset_type)
        .bind(&row.wallet)
        .bind(&row.symbol)
        .bind(row.amount)
        .bind(row.price)
        .bind(&row.txn_type)
        .bind(&row.txn_created_at)
        .bind(&row.created_at)
        .bind(&row.updated_at)
        .execute(&mut connection)
        .await
        .map_err(|_| "Failed to insert sync transaction".to_string())?;
    }
    sqlx::query(
        "INSERT INTO sync_applied_objects (object_key, applied_at) VALUES (?, CURRENT_TIMESTAMP)",
    )
    .bind(marker)
    .execute(&mut connection)
    .await
    .map_err(|_| "Failed to record sync snapshot".to_string())?;
    Ok(true)
    }.await;
    let finished = if result.is_ok() {
        match connection.execute("COMMIT").await {
            Ok(_) => Ok(()),
            Err(_) => {
                let _ = connection.execute("ROLLBACK").await;
                Err("Failed to commit sync snapshot".to_string())
            }
        }
    } else {
        connection
            .execute("ROLLBACK")
            .await
            .map(|_| ())
            .map_err(|_| "Failed to roll back sync snapshot".to_string())
    };
    let _ = connection.close().await;
    finished?;
    result
}

pub async fn delete_sync_snapshot(database_path: &Path, uuid: &str) -> Result<(), String> {
    if uuid.is_empty() {
        return Err("Invalid sync snapshot id".to_string());
    }
    let mut connection = connect(database_path).await?;
    if connection.execute("BEGIN IMMEDIATE").await.is_err() {
        let _ = connection.close().await;
        return Err("Failed to begin sync delete".to_string());
    }
    let result: Result<(), String> = async {
        for table in ["asset_prices", "transactions", "assets_v2"] {
            sqlx::query(&format!("DELETE FROM {table} WHERE uuid = ?"))
                .bind(uuid)
                .execute(&mut connection)
                .await
                .map_err(|_| "Failed to delete sync snapshot".to_string())?;
        }
        sqlx::query("DELETE FROM sync_applied_objects WHERE object_key = ?")
            .bind(format!("snapshot:{uuid}"))
            .execute(&mut connection)
            .await
            .map_err(|_| "Failed to clear sync snapshot marker".to_string())?;
        Ok(())
    }
    .await;
    let finished = if result.is_ok() {
        match connection.execute("COMMIT").await {
            Ok(_) => Ok(()),
            Err(_) => {
                let _ = connection.execute("ROLLBACK").await;
                Err("Failed to commit sync delete".to_string())
            }
        }
    } else {
        connection
            .execute("ROLLBACK")
            .await
            .map(|_| ())
            .map_err(|_| "Failed to roll back sync delete".to_string())
    };
    let _ = connection.close().await;
    finished?;
    result
}
