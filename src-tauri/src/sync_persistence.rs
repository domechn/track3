use crate::edit_log;
use crate::snapshot_partial::PartialSnapshot;
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqliteConnectOptions, Connection, Executor, SqliteConnection};
use std::{collections::HashMap, path::Path, time::Duration};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotStateRow {
    pub snapshot_id: String,
    pub snapshot_hash: Option<String>,
    pub snapshot_edit: Option<String>,
    pub pending_snapshot_edit: Option<String>,
    pub published: i64,
    pub known: String,
    pub asset_rows: Option<String>,
    pub transaction_rows: Option<String>,
    pub row_events: Option<String>,
    pub transaction_events: Option<String>,
}

pub async fn upsert_snapshot_state(
    connection: &mut SqliteConnection,
    row: &SnapshotStateRow,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO sync_snapshot_state
         (snapshot_id, snapshot_hash, snapshot_edit, pending_snapshot_edit, published, known,
          asset_rows, transaction_rows, row_events, transaction_events)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(snapshot_id) DO UPDATE SET
         snapshot_hash = excluded.snapshot_hash, snapshot_edit = excluded.snapshot_edit,
         pending_snapshot_edit = excluded.pending_snapshot_edit, published = excluded.published,
         known = excluded.known, asset_rows = excluded.asset_rows,
         transaction_rows = excluded.transaction_rows, row_events = excluded.row_events,
         transaction_events = excluded.transaction_events",
    )
    .bind(&row.snapshot_id)
    .bind(&row.snapshot_hash)
    .bind(&row.snapshot_edit)
    .bind(&row.pending_snapshot_edit)
    .bind(row.published)
    .bind(&row.known)
    .bind(&row.asset_rows)
    .bind(&row.transaction_rows)
    .bind(&row.row_events)
    .bind(&row.transaction_events)
    .execute(connection)
    .await
    .map(|_| ())
}

pub async fn save_sync_state(
    database_path: &Path,
    data: &str,
    rows: &[SnapshotStateRow],
    deleted_ids: &[String],
    clear_snapshots: bool,
) -> Result<(), String> {
    if serde_json::from_str::<serde_json::Value>(data).is_err() {
        return Err("Invalid sync state".to_string());
    }
    let mut connection = connect(database_path).await?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|_| "Failed to begin sync state save".to_string())?;
    if clear_snapshots {
        sqlx::query("DELETE FROM sync_snapshot_state")
            .execute(&mut *transaction)
            .await
            .map_err(|_| "Failed to clear sync snapshot state".to_string())?;
    }
    for id in deleted_ids {
        sqlx::query("DELETE FROM sync_snapshot_state WHERE snapshot_id = ?")
            .bind(id)
            .execute(&mut *transaction)
            .await
            .map_err(|_| "Failed to delete sync snapshot state".to_string())?;
    }
    for row in rows {
        upsert_snapshot_state(&mut transaction, row)
            .await
            .map_err(|_| "Failed to save sync snapshot state".to_string())?;
    }
    sqlx::query(
        "INSERT INTO sync_state (id, data) VALUES (1, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    )
    .bind(data)
    .execute(&mut *transaction)
    .await
    .map_err(|_| "Failed to save sync state".to_string())?;
    transaction
        .commit()
        .await
        .map_err(|_| "Failed to commit sync state".to_string())?;
    connection
        .close()
        .await
        .map_err(|_| "Failed to close sync database".to_string())
}

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
    id: Option<i64>,
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
    persist_sync_snapshot(database_path, value, false, false, None, Vec::new()).await
}

pub async fn replace_sync_snapshot(
    database_path: &Path,
    value: serde_json::Value,
) -> Result<(), String> {
    persist_sync_snapshot(database_path, value, true, false, None, Vec::new())
        .await
        .map(|_| ())
}

pub async fn replace_import_snapshot(
    database_path: &Path,
    value: serde_json::Value,
) -> Result<(), String> {
    persist_sync_snapshot(
        database_path,
        value,
        true,
        true,
        Some(("import", "replace")),
        Vec::new(),
    )
    .await
    .map(|_| ())
}

pub async fn restore_local_snapshot(
    database_path: &Path,
    value: serde_json::Value,
    orphan_transactions: serde_json::Value,
) -> Result<(), String> {
    let orphans: Vec<Transaction> = serde_json::from_value(orphan_transactions)
        .map_err(|_| "Invalid orphan transactions".to_string())?;
    persist_sync_snapshot(
        database_path,
        value,
        false,
        false,
        Some(("local", "restore")),
        orphans,
    )
    .await
    .and_then(|imported| {
        if imported {
            Ok(())
        } else {
            Err("Snapshot already exists".to_string())
        }
    })
}

async fn persist_sync_snapshot(
    database_path: &Path,
    value: serde_json::Value,
    replace: bool,
    preserve_local_prices: bool,
    log: Option<(&str, &str)>,
    orphan_transactions: Vec<Transaction>,
) -> Result<bool, String> {
    let partial =
        value
            .get("partial")
            .and_then(|value| match PartialSnapshot::from_value(value.clone()) {
                Ok(marker) => Some(marker),
                Err(_) => {
                    eprintln!("Ignoring invalid optional partial snapshot marker");
                    None
                }
            });
    let mut snapshot: Snapshot =
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
        || orphan_transactions.iter().any(|row| {
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
    let old_summary = if log.is_some() && replace {
        Some(snapshot_summary_from_db(&mut connection, &snapshot.uuid).await?)
    } else {
        None
    };
    let replacement_changed = if log.is_some() && replace {
        snapshot_differs(&mut connection, &snapshot).await?
    } else {
        false
    };
    if preserve_local_prices {
        if !snapshot.prices.is_empty() {
            return Err("Import file cannot replace local cost prices".to_string());
        }
        let rows: Vec<(String, String, String, String, f64, String, String)> = sqlx::query_as(
            "SELECT a.asset_type, a.wallet, a.symbol, p.symbol, p.price, p.assetCreatedAt, p.updatedAt
             FROM asset_prices p JOIN assets_v2 a ON a.id = p.assetID AND a.uuid = p.uuid WHERE p.uuid = ?",
        )
        .bind(&snapshot.uuid)
        .fetch_all(&mut connection)
        .await
        .map_err(|_| "Failed to read local cost prices".to_string())?;
        let price_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM asset_prices WHERE uuid = ?")
            .bind(&snapshot.uuid)
            .fetch_one(&mut connection)
            .await
            .map_err(|_| "Failed to read local cost prices".to_string())?;
        if price_count != rows.len() as i64 {
            return Err("Cannot replace snapshot without losing local cost prices".to_string());
        }
        for (asset_type, wallet, symbol, price_symbol, price, asset_created_at, updated_at) in rows {
            let asset = snapshot.assets.iter().find(|asset| {
                asset.asset_type == asset_type
                    && asset.wallet.as_deref().unwrap_or("") == wallet
                    && asset.symbol == symbol
            }).ok_or_else(|| "Cannot replace snapshot without losing local cost prices".to_string())?;
            snapshot.prices.push(Price {
                uuid: snapshot.uuid.clone(),
                asset_id: asset.id,
                symbol: price_symbol,
                price,
                asset_created_at,
                updated_at,
            });
        }
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
    for row in &orphan_transactions {
        sqlx::query(
            "INSERT INTO transactions
             (id, uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(row.id).bind(&row.uuid).bind(row.asset_id).bind(&row.asset_type)
        .bind(&row.wallet).bind(&row.symbol).bind(row.amount).bind(row.price)
        .bind(&row.txn_type).bind(&row.txn_created_at).bind(&row.created_at).bind(&row.updated_at)
        .execute(&mut connection).await
        .map_err(|_| "Failed to restore orphan transaction".to_string())?;
    }
    sqlx::query(
        "INSERT INTO sync_applied_objects (object_key, applied_at) VALUES (?, CURRENT_TIMESTAMP)",
    )
    .bind(marker)
    .execute(&mut connection)
    .await
    .map_err(|_| "Failed to record sync snapshot".to_string())?;
    if let Some(partial) = &partial {
        partial.insert(&mut connection, &snapshot.uuid).await?;
    }
    if let Some((origin, action)) = log {
        if !replace || replacement_changed {
            let new_summary = if orphan_transactions.is_empty() {
                snapshot_summary(&snapshot)
            } else {
                serde_json::json!({
                    "assets": snapshot.assets.len(),
                    "transactions": snapshot.transactions.len() + orphan_transactions.len(),
                    "total": snapshot.assets.iter().map(|asset| asset.value).sum::<f64>(),
                }).to_string()
            };
            edit_log::record(
                &mut connection, &snapshot.uuid, origin, "snapshot", action,
                None, None, None, old_summary.as_deref(), Some(&new_summary),
            ).await?;
        }
    }
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

fn snapshot_summary(snapshot: &Snapshot) -> String {
    serde_json::json!({
        "assets": snapshot.assets.len(),
        "transactions": snapshot.transactions.len(),
        "total": snapshot.assets.iter().map(|asset| asset.value).sum::<f64>(),
    })
    .to_string()
}

async fn snapshot_summary_from_db(db: &mut SqliteConnection, uuid: &str) -> Result<String, String> {
    let (assets, total): (i64, f64) =
        sqlx::query_as("SELECT COUNT(*), COALESCE(SUM(value), 0) FROM assets_v2 WHERE uuid = ?")
            .bind(uuid)
            .fetch_one(&mut *db)
            .await
            .map_err(|_| "Failed to read snapshot summary".to_string())?;
    let transactions: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM transactions WHERE uuid = ?")
        .bind(uuid)
        .fetch_one(db)
        .await
        .map_err(|_| "Failed to read snapshot summary".to_string())?;
    Ok(
        serde_json::json!({"assets": assets, "transactions": transactions, "total": total})
            .to_string(),
    )
}

async fn snapshot_differs(db: &mut SqliteConnection, snapshot: &Snapshot) -> Result<bool, String> {
    let mut assets: Vec<(String, String, String, String, f64, f64, f64)> = sqlx::query_as(
        "SELECT createdAt, asset_type, wallet, symbol, amount, value, price FROM assets_v2 WHERE uuid = ?",
    ).bind(&snapshot.uuid).fetch_all(&mut *db).await.map_err(|_| "Failed to compare snapshot assets".to_string())?;
    let mut incoming_assets = snapshot
        .assets
        .iter()
        .map(|asset| {
            (
                asset.created_at.clone(),
                asset.asset_type.clone(),
                asset.wallet.clone().unwrap_or_default(),
                asset.symbol.clone(),
                asset.amount,
                asset.value,
                asset.price,
            )
        })
        .collect::<Vec<_>>();
    let asset_order = |a: &(String, String, String, String, f64, f64, f64),
                       b: &(String, String, String, String, f64, f64, f64)| {
        a.0.cmp(&b.0)
            .then(a.1.cmp(&b.1))
            .then(a.2.cmp(&b.2))
            .then(a.3.cmp(&b.3))
            .then(a.4.total_cmp(&b.4))
            .then(a.5.total_cmp(&b.5))
            .then(a.6.total_cmp(&b.6))
    };
    assets.sort_by(asset_order);
    incoming_assets.sort_by(asset_order);
    if assets != incoming_assets {
        return Ok(true);
    }
    let mut transactions: Vec<(String, String, String, f64, f64, String, String, String, String)> = sqlx::query_as(
        "SELECT asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt
         FROM transactions WHERE uuid = ?",
    ).bind(&snapshot.uuid).fetch_all(db).await.map_err(|_| "Failed to compare snapshot transactions".to_string())?;
    let mut incoming_transactions = snapshot
        .transactions
        .iter()
        .map(|row| {
            (
                row.asset_type.clone(),
                row.wallet.clone(),
                row.symbol.clone(),
                row.amount,
                row.price,
                row.txn_type.clone(),
                row.txn_created_at.clone(),
                row.created_at.clone(),
                row.updated_at.clone(),
            )
        })
        .collect::<Vec<_>>();
    let transaction_order = |a: &(
        String,
        String,
        String,
        f64,
        f64,
        String,
        String,
        String,
        String,
    ),
                             b: &(
        String,
        String,
        String,
        f64,
        f64,
        String,
        String,
        String,
        String,
    )| {
        a.0.cmp(&b.0)
            .then(a.1.cmp(&b.1))
            .then(a.2.cmp(&b.2))
            .then(a.3.total_cmp(&b.3))
            .then(a.4.total_cmp(&b.4))
            .then(a.5.cmp(&b.5))
            .then(a.6.cmp(&b.6))
            .then(a.7.cmp(&b.7))
            .then(a.8.cmp(&b.8))
    };
    transactions.sort_by(transaction_order);
    incoming_transactions.sort_by(transaction_order);
    Ok(transactions != incoming_transactions)
}

pub async fn delete_sync_snapshot(database_path: &Path, uuid: &str) -> Result<(), String> {
    delete_snapshot(database_path, uuid, false).await
}

pub async fn delete_local_snapshot(database_path: &Path, uuid: &str) -> Result<(), String> {
    delete_snapshot(database_path, uuid, true).await
}

async fn delete_snapshot(database_path: &Path, uuid: &str, local: bool) -> Result<(), String> {
    if uuid.is_empty() {
        return Err("Invalid sync snapshot id".to_string());
    }
    let mut connection = connect(database_path).await?;
    if connection.execute("BEGIN IMMEDIATE").await.is_err() {
        let _ = connection.close().await;
        return Err("Failed to begin sync delete".to_string());
    }
    let result: Result<(), String> = async {
        let old_summary = if local {
            Some(snapshot_summary_from_db(&mut connection, uuid).await?)
        } else {
            None
        };
        for table in [
            "asset_prices",
            "transactions",
            "assets_v2",
            "snapshot_partial",
        ] {
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
        if let Some(summary) = old_summary {
            edit_log::record(
                &mut connection,
                uuid,
                "local",
                "snapshot",
                "delete",
                None,
                None,
                None,
                Some(&summary),
                None,
            )
            .await?;
        }
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
