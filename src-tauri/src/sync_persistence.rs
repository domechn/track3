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

const INVALID_SNAPSHOT: &str = "Invalid sync snapshot";

#[derive(Clone, Copy)]
enum FieldKind {
    Text,
    Float,
    Int,
    OptionalText,
    OptionalInt,
}

// Mirrors the serde shape of Asset, Price and Transaction: (name, alias, kind).
type FieldSchema = [(&'static str, Option<&'static str>, FieldKind)];
const ASSET_FIELDS: &FieldSchema = &[
    ("id", None, FieldKind::Int),
    ("uuid", None, FieldKind::Text),
    ("createdAt", None, FieldKind::Text),
    ("assetType", Some("asset_type"), FieldKind::Text),
    ("wallet", None, FieldKind::OptionalText),
    ("symbol", None, FieldKind::Text),
    ("amount", None, FieldKind::Float),
    ("value", None, FieldKind::Float),
    ("price", None, FieldKind::Float),
];
const PRICE_FIELDS: &FieldSchema = &[
    ("uuid", None, FieldKind::Text),
    ("assetID", None, FieldKind::Int),
    ("symbol", None, FieldKind::Text),
    ("price", None, FieldKind::Float),
    ("assetCreatedAt", None, FieldKind::Text),
    ("updatedAt", None, FieldKind::Text),
];
const TRANSACTION_FIELDS: &FieldSchema = &[
    ("id", None, FieldKind::OptionalInt),
    ("uuid", None, FieldKind::Text),
    ("assetID", None, FieldKind::Int),
    ("assetType", Some("asset_type"), FieldKind::Text),
    ("wallet", None, FieldKind::Text),
    ("symbol", None, FieldKind::Text),
    ("amount", None, FieldKind::Float),
    ("price", None, FieldKind::Float),
    ("txnType", None, FieldKind::Text),
    ("txnCreatedAt", None, FieldKind::Text),
    ("createdAt", None, FieldKind::Text),
    ("updatedAt", None, FieldKind::Text),
];

fn json_type(value: Option<&serde_json::Value>) -> &'static str {
    match value {
        None => "missing",
        Some(serde_json::Value::Null) => "null",
        Some(serde_json::Value::Bool(_)) => "bool",
        Some(serde_json::Value::Number(_)) => "number",
        Some(serde_json::Value::String(_)) => "string",
        Some(serde_json::Value::Array(_)) => "array",
        Some(serde_json::Value::Object(_)) => "object",
    }
}

fn field_problem(value: Option<&serde_json::Value>, kind: FieldKind) -> Option<&'static str> {
    use serde_json::Value;
    let accepted = match (kind, value) {
        (FieldKind::OptionalText | FieldKind::OptionalInt, None | Some(Value::Null)) => true,
        (FieldKind::Text | FieldKind::OptionalText, Some(Value::String(_))) => true,
        (FieldKind::Float, Some(Value::Number(_))) => true,
        (FieldKind::Int | FieldKind::OptionalInt, Some(Value::Number(number))) => {
            if !number.is_i64() {
                return Some("non-i64 number");
            }
            true
        }
        _ => false,
    };
    (!accepted).then(|| json_type(value))
}

// Names the first field serde rejected: its path and JSON type only, never its value.
fn parse_reason(value: &serde_json::Value) -> String {
    let fail = |field: String, found: &str, path: String| {
        format!("{INVALID_SNAPSHOT}: parse ({field} is {found}) at {path}")
    };
    let Some(root) = value.as_object() else {
        return format!(
            "{INVALID_SNAPSHOT}: parse (snapshot is {})",
            json_type(Some(value))
        );
    };
    if !matches!(root.get("uuid"), Some(serde_json::Value::String(_))) {
        return fail("uuid".into(), json_type(root.get("uuid")), "uuid".into());
    }
    for (table, fields) in [
        ("assets", ASSET_FIELDS),
        ("prices", PRICE_FIELDS),
        ("transactions", TRANSACTION_FIELDS),
    ] {
        let Some(serde_json::Value::Array(rows)) = root.get(table) else {
            return fail(table.into(), json_type(root.get(table)), table.into());
        };
        for (index, row) in rows.iter().enumerate() {
            let Some(row) = row.as_object() else {
                return fail(
                    format!("{table}[]"),
                    json_type(Some(row)),
                    format!("{table}[{index}]"),
                );
            };
            for (name, alias, kind) in fields {
                let aliased = alias.and_then(|alias| row.get(alias));
                let found = match (row.get(*name), aliased) {
                    (Some(_), Some(_)) => Some("duplicate"),
                    (value, aliased) => field_problem(value.or(aliased), *kind),
                };
                if let Some(found) = found {
                    return fail(
                        format!("{table}[].{name}"),
                        found,
                        format!("{table}[{index}].{name}"),
                    );
                }
            }
        }
    }
    format!("{INVALID_SNAPSHOT}: parse (unknown)")
}

fn validate_snapshot(snapshot: &Snapshot, orphans: &[Transaction]) -> Result<(), String> {
    if snapshot.uuid.is_empty() {
        return Err(format!("{INVALID_SNAPSHOT}: empty uuid"));
    }
    let check = |table: &str, row: String, uuid: &str, numbers: &[(&str, f64)]| {
        if uuid != snapshot.uuid {
            return Err(format!(
                "{INVALID_SNAPSHOT}: uuid mismatch ({table}) at {row}.uuid"
            ));
        }
        match numbers.iter().find(|(_, number)| !number.is_finite()) {
            Some((name, _)) => Err(format!(
                "{INVALID_SNAPSHOT}: non-finite {name} ({table}) at {row}.{name}"
            )),
            None => Ok(()),
        }
    };
    for (index, row) in snapshot.assets.iter().enumerate() {
        if row.id <= 0 {
            return Err(format!(
                "{INVALID_SNAPSHOT}: asset id <= 0 at assets[{index}].id"
            ));
        }
        let numbers = [
            ("amount", row.amount),
            ("value", row.value),
            ("price", row.price),
        ];
        check("assets", format!("assets[{index}]"), &row.uuid, &numbers)?;
    }
    for (index, row) in snapshot.prices.iter().enumerate() {
        let numbers = [("price", row.price)];
        check("prices", format!("prices[{index}]"), &row.uuid, &numbers)?;
    }
    for (table, path, rows) in [
        ("transactions", "transactions", &snapshot.transactions[..]),
        ("orphan transactions", "orphanTransactions", orphans),
    ] {
        for (index, row) in rows.iter().enumerate() {
            let numbers = [("amount", row.amount), ("price", row.price)];
            check(table, format!("{path}[{index}]"), &row.uuid, &numbers)?;
        }
    }
    Ok(())
}

fn parse_snapshot(value: &serde_json::Value, orphans: &[Transaction]) -> Result<Snapshot, String> {
    let snapshot = Snapshot::deserialize(value).map_err(|_| parse_reason(value))?;
    validate_snapshot(&snapshot, orphans)?;
    Ok(snapshot)
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
    let mut snapshot = parse_snapshot(&value, &orphan_transactions)?;
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

#[cfg(test)]
mod tests {
    use super::{parse_snapshot, Snapshot, Transaction};
    use serde_json::{json, Value};

    fn valid() -> Value {
        json!({
            "uuid": "remote",
            "assets": [
                {"id": 1, "uuid": "remote", "createdAt": "2026-01-01", "wallet": "w", "asset_type": "crypto", "symbol": "ETH", "amount": 2, "value": 4, "price": 2},
                {"id": 2, "uuid": "remote", "createdAt": "2026-01-01", "assetType": "crypto", "symbol": "BTC", "amount": 1, "value": 9, "price": 9}
            ],
            "prices": [{"uuid": "remote", "assetID": 1, "symbol": "ETH", "price": 2, "assetCreatedAt": "2026-01-01", "updatedAt": "2026-01-01"}],
            "transactions": [{"uuid": "remote", "assetID": 1, "asset_type": "crypto", "wallet": "w", "symbol": "ETH", "amount": 2, "price": 2, "txnType": "buy", "txnCreatedAt": "2026-01-01", "createdAt": "2026-01-01", "updatedAt": "2026-01-01"}]
        })
    }

    fn reason(value: Value) -> String {
        parse_snapshot(&value, &[]).err().unwrap()
    }

    fn orphan(uuid: &str) -> Transaction {
        let mut row = valid()["transactions"][0].clone();
        row["uuid"] = json!(uuid);
        serde_json::from_value(row).unwrap()
    }

    fn parsed() -> Snapshot {
        parse_snapshot(&valid(), &[]).ok().unwrap()
    }

    #[test]
    fn accepts_a_valid_snapshot() {
        assert!(parse_snapshot(&valid(), &[orphan("remote")]).is_ok());
    }

    #[test]
    fn names_the_first_field_that_fails_to_parse_without_its_value() {
        let mut value = valid();
        value["assets"][1]["price"] = Value::Null;
        assert_eq!(
            reason(value),
            "Invalid sync snapshot: parse (assets[].price is null) at assets[1].price"
        );
        let mut value = valid();
        value["prices"][0].as_object_mut().unwrap().remove("assetID");
        assert_eq!(
            reason(value),
            "Invalid sync snapshot: parse (prices[].assetID is missing) at prices[0].assetID"
        );
        let mut value = valid();
        value["transactions"][0]["amount"] = json!("secret-amount-12.5");
        let message = reason(value);
        assert_eq!(
            message,
            "Invalid sync snapshot: parse (transactions[].amount is string) at transactions[0].amount"
        );
        assert!(!message.contains("secret"));
        let mut value = valid();
        value["assets"][0]["id"] = json!(1.5);
        assert_eq!(
            reason(value),
            "Invalid sync snapshot: parse (assets[].id is non-i64 number) at assets[0].id"
        );
        let mut value = valid();
        value["assets"][0]["assetType"] = json!("crypto");
        assert_eq!(
            reason(value),
            "Invalid sync snapshot: parse (assets[].assetType is duplicate) at assets[0].assetType"
        );
    }

    #[test]
    fn every_schema_field_is_one_serde_rejects() {
        for (table, fields) in [
            ("assets", super::ASSET_FIELDS),
            ("prices", super::PRICE_FIELDS),
            ("transactions", super::TRANSACTION_FIELDS),
        ] {
            for (name, _, _) in fields {
                let mut value = valid();
                value[table][0][*name] = json!(true);
                let expected = if *name == "assetType" && table != "prices" { "duplicate" } else { "bool" };
                assert_eq!(
                    reason(value),
                    format!("Invalid sync snapshot: parse ({table}[].{name} is {expected}) at {table}[0].{name}")
                );
            }
        }
    }

    #[test]
    fn names_top_level_parse_failures() {
        let mut value = valid();
        value.as_object_mut().unwrap().remove("uuid");
        assert_eq!(
            reason(value),
            "Invalid sync snapshot: parse (uuid is missing) at uuid"
        );
        let mut value = valid();
        value["prices"] = json!({});
        assert_eq!(
            reason(value),
            "Invalid sync snapshot: parse (prices is object) at prices"
        );
        let mut value = valid();
        value["assets"][0] = json!(7);
        assert_eq!(
            reason(value),
            "Invalid sync snapshot: parse (assets[] is number) at assets[0]"
        );
        assert_eq!(
            reason(json!([])),
            "Invalid sync snapshot: parse (snapshot is array)"
        );
    }

    #[test]
    fn rejects_an_empty_uuid() {
        let mut value = valid();
        value["uuid"] = json!("");
        assert_eq!(reason(value), "Invalid sync snapshot: empty uuid");
    }

    #[test]
    fn names_the_table_of_a_uuid_mismatch() {
        for (table, path) in [
            ("assets", "assets[1].uuid"),
            ("prices", "prices[0].uuid"),
            ("transactions", "transactions[0].uuid"),
        ] {
            let mut value = valid();
            let index = usize::from(table == "assets");
            value[table][index]["uuid"] = json!("other");
            assert_eq!(
                reason(value),
                format!("Invalid sync snapshot: uuid mismatch ({table}) at {path}")
            );
        }
        assert_eq!(
            parse_snapshot(&valid(), &[orphan("remote"), orphan("other")]).err().unwrap(),
            "Invalid sync snapshot: uuid mismatch (orphan transactions) at orphanTransactions[1].uuid"
        );
    }

    #[test]
    fn rejects_non_positive_asset_ids() {
        let mut value = valid();
        value["assets"][1]["id"] = json!(0);
        assert_eq!(
            reason(value),
            "Invalid sync snapshot: asset id <= 0 at assets[1].id"
        );
    }

    #[test]
    fn names_non_finite_numbers() {
        // JSON cannot carry NaN or Infinity, so this branch needs parsed rows.
        let check = |change: fn(&mut Snapshot), expected: &str| {
            let mut snapshot = parsed();
            change(&mut snapshot);
            assert_eq!(
                super::validate_snapshot(&snapshot, &[]).unwrap_err(),
                format!("Invalid sync snapshot: non-finite {expected}")
            );
        };
        check(|s| s.assets[1].amount = f64::NAN, "amount (assets) at assets[1].amount");
        check(|s| s.assets[0].value = f64::INFINITY, "value (assets) at assets[0].value");
        check(|s| s.assets[0].price = f64::NEG_INFINITY, "price (assets) at assets[0].price");
        check(|s| s.prices[0].price = f64::NAN, "price (prices) at prices[0].price");
        check(|s| s.transactions[0].amount = f64::NAN, "amount (transactions) at transactions[0].amount");
        check(|s| s.transactions[0].price = f64::NAN, "price (transactions) at transactions[0].price");
        let mut row = orphan("remote");
        row.price = f64::NAN;
        assert_eq!(
            super::validate_snapshot(&parsed(), &[row]).unwrap_err(),
            "Invalid sync snapshot: non-finite price (orphan transactions) at orphanTransactions[0].price"
        );
    }
}
