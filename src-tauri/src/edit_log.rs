use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection};
use std::{path::Path, time::Duration};

#[derive(sqlx::FromRow)]
struct TransactionBefore {
    uuid: String,
    asset_type: String,
    symbol: String,
    wallet: String,
    price: f64,
    txn_type: String,
}

#[derive(Clone, Deserialize, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct AssetRow {
    id: i64,
    uuid: String,
    created_at: String,
    asset_type: String,
    wallet: Option<String>,
    symbol: String,
    amount: f64,
    value: f64,
    price: f64,
}

#[derive(Deserialize, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct TransactionRow {
    id: i64,
    uuid: String,
    #[serde(rename = "assetID")]
    asset_id: i64,
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

#[derive(Deserialize, Serialize)]
struct AssetBackup {
    assets: Vec<AssetRow>,
    transactions: Vec<TransactionRow>,
}

async fn connect(path: &Path) -> Result<SqliteConnection, String> {
    SqliteConnection::connect_with(
        &SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(false)
            .busy_timeout(Duration::from_secs(5)),
    )
    .await
    .map_err(|_| "Failed to open edit database".to_string())
}

pub async fn record(
    db: &mut SqliteConnection,
    uuid: &str,
    origin: &str,
    target: &str,
    action: &str,
    asset_type: Option<&str>,
    symbol: Option<&str>,
    wallet: Option<&str>,
    old_value: Option<&str>,
    new_value: Option<&str>,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO snapshot_edit_log
         (snapshot_uuid, edited_at, origin, target, action, asset_type, symbol, wallet, old_value, new_value)
         VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(uuid).bind(origin).bind(target).bind(action)
    .bind(asset_type).bind(symbol).bind(wallet).bind(old_value).bind(new_value)
    .execute(&mut *db).await
    .map_err(|_| "Failed to record snapshot edit".to_string())?;
    sqlx::query(
        "DELETE FROM snapshot_edit_log WHERE id <=
         (SELECT id FROM snapshot_edit_log ORDER BY id DESC LIMIT 1 OFFSET 5000)",
    )
    .execute(db)
    .await
    .map_err(|_| "Failed to prune snapshot edit log".to_string())?;
    Ok(())
}

pub async fn update_transaction_price(path: &Path, id: i64, price: f64) -> Result<(), String> {
    if !price.is_finite() {
        return Err("Invalid transaction price".to_string());
    }
    update_transaction(path, id, "price", price.to_string()).await
}

pub async fn update_transaction_type(path: &Path, id: i64, txn_type: &str) -> Result<(), String> {
    if !["buy", "sell", "deposit", "withdraw"].contains(&txn_type) {
        return Err("Invalid transaction type".to_string());
    }
    update_transaction(path, id, "txnType", txn_type.to_string()).await
}

async fn update_transaction(
    path: &Path,
    id: i64,
    action: &str,
    new_value: String,
) -> Result<(), String> {
    let mut db = connect(path).await?;
    let mut tx = db
        .begin()
        .await
        .map_err(|_| "Failed to begin transaction edit".to_string())?;
    let before: TransactionBefore = sqlx::query_as(
        "SELECT uuid, asset_type, symbol, wallet, price, txnType AS txn_type FROM transactions WHERE id = ?",
    )
    .bind(id).fetch_one(&mut *tx).await
    .map_err(|_| "Transaction not found".to_string())?;
    let old_value = if action == "price" {
        before.price.to_string()
    } else {
        before.txn_type.clone()
    };
    if old_value == new_value {
        return Ok(());
    }
    let field = if action == "price" {
        "price"
    } else {
        "txnType"
    };
    sqlx::query(&format!("UPDATE transactions SET {field} = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"))
        .bind(&new_value)
        .bind(id).execute(&mut *tx).await
        .map_err(|_| "Failed to update transaction".to_string())?;
    record(
        &mut tx,
        &before.uuid,
        "local",
        "transaction",
        action,
        Some(&before.asset_type),
        Some(&before.symbol),
        Some(&before.wallet),
        Some(&old_value),
        Some(&new_value),
    )
    .await?;
    tx.commit()
        .await
        .map_err(|_| "Failed to commit transaction edit".to_string())
}

pub async fn delete_local_asset(path: &Path, id: i64) -> Result<serde_json::Value, String> {
    let mut db = connect(path).await?;
    let mut tx = db
        .begin()
        .await
        .map_err(|_| "Failed to begin asset delete".to_string())?;
    let asset: AssetRow = sqlx::query_as(
        "SELECT id, uuid, createdAt AS created_at, asset_type, wallet, symbol, amount, value, price
         FROM assets_v2 WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| "Asset not found".to_string())?;
    let transactions: Vec<TransactionRow> = sqlx::query_as(
        "SELECT id, uuid, assetID AS asset_id, asset_type, wallet, symbol, amount, price,
                txnType AS txn_type, txnCreatedAt AS txn_created_at, createdAt AS created_at,
                updatedAt AS updated_at FROM transactions WHERE assetID = ?",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|_| "Failed to read asset transactions".to_string())?;
    sqlx::query("DELETE FROM transactions WHERE assetID = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|_| "Failed to delete asset transactions".to_string())?;
    sqlx::query("DELETE FROM assets_v2 WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|_| "Failed to delete asset".to_string())?;
    let old =
        serde_json::json!({"amount": asset.amount, "value": asset.value, "price": asset.price})
            .to_string();
    record(
        &mut tx,
        &asset.uuid,
        "local",
        "asset",
        "delete",
        Some(&asset.asset_type),
        Some(&asset.symbol),
        asset.wallet.as_deref(),
        Some(&old),
        None,
    )
    .await?;
    tx.commit()
        .await
        .map_err(|_| "Failed to commit asset delete".to_string())?;
    serde_json::to_value(AssetBackup {
        assets: vec![asset],
        transactions,
    })
    .map_err(|_| "Failed to encode asset backup".to_string())
}

pub async fn restore_local_asset(path: &Path, value: serde_json::Value) -> Result<(), String> {
    let backup: AssetBackup =
        serde_json::from_value(value).map_err(|_| "Invalid asset backup".to_string())?;
    let [asset] = backup.assets.as_slice() else {
        return Err("Invalid asset backup".to_string());
    };
    if backup
        .transactions
        .iter()
        .any(|txn| txn.asset_id != asset.id || txn.uuid != asset.uuid)
    {
        return Err("Invalid asset backup".to_string());
    }
    let mut db = connect(path).await?;
    let mut tx = db
        .begin()
        .await
        .map_err(|_| "Failed to begin asset restore".to_string())?;
    sqlx::query(
        "INSERT INTO assets_v2 (id, uuid, createdAt, asset_type, wallet, symbol, amount, value, price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(asset.id).bind(&asset.uuid).bind(&asset.created_at).bind(&asset.asset_type)
    .bind(asset.wallet.as_deref().unwrap_or("")).bind(&asset.symbol).bind(asset.amount).bind(asset.value).bind(asset.price)
    .execute(&mut *tx).await.map_err(|_| "Failed to restore asset".to_string())?;
    for row in &backup.transactions {
        sqlx::query(
            "INSERT INTO transactions
             (id, uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(row.id).bind(&row.uuid).bind(row.asset_id).bind(&row.asset_type)
        .bind(&row.wallet).bind(&row.symbol).bind(row.amount).bind(row.price)
        .bind(&row.txn_type).bind(&row.txn_created_at).bind(&row.created_at).bind(&row.updated_at)
        .execute(&mut *tx).await.map_err(|_| "Failed to restore asset transactions".to_string())?;
    }
    let new =
        serde_json::json!({"amount": asset.amount, "value": asset.value, "price": asset.price})
            .to_string();
    record(
        &mut tx,
        &asset.uuid,
        "local",
        "asset",
        "restore",
        Some(&asset.asset_type),
        Some(&asset.symbol),
        asset.wallet.as_deref(),
        None,
        Some(&new),
    )
    .await?;
    tx.commit()
        .await
        .map_err(|_| "Failed to commit asset restore".to_string())
}
