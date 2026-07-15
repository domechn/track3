use crate::types::{RefreshAssetInput, RefreshTransactionInput};
use sha2::{Digest, Sha256};
use sqlx::{sqlite::SqliteConnectOptions, Connection, Executor, SqliteConnection};
use std::{
    collections::{HashMap, HashSet},
    path::Path,
    time::Duration,
};
use tokio::sync::Mutex;
use uuid::Uuid;

type AssetIdentity = (String, String, String);
static REFRESH_PERSISTENCE_LOCK: Mutex<()> = Mutex::const_new(());

pub async fn persist_refresh(
    database_path: &Path,
    operation_uuid: &str,
    created_at: &str,
    assets: &[RefreshAssetInput],
    transactions: &[RefreshTransactionInput],
) -> Result<(), String> {
    validate_inputs(operation_uuid, created_at, assets, transactions)?;
    let payload_digest = payload_digest(created_at, assets, transactions);
    let _write_guard = REFRESH_PERSISTENCE_LOCK.lock().await;

    let options = SqliteConnectOptions::new()
        .filename(database_path)
        .create_if_missing(false)
        .busy_timeout(Duration::from_secs(5));
    let mut connection = sqlx::SqliteConnection::connect_with(&options)
        .await
        .map_err(|error| {
            format!(
                "failed to open refresh database {}: {error}",
                database_path.display()
            )
        })?;
    connection
        .execute("BEGIN IMMEDIATE")
        .await
        .map_err(|error| format!("failed to begin refresh transaction: {error}"))?;

    let result = persist_in_transaction(
        &mut connection,
        operation_uuid,
        created_at,
        assets,
        transactions,
        &payload_digest,
    )
    .await;

    match result {
        Ok(()) => connection
            .execute("COMMIT")
            .await
            .map(|_| ())
            .map_err(|error| format!("failed to commit refresh transaction: {error}")),
        Err(error) => match connection.execute("ROLLBACK").await {
            Ok(_) => Err(error),
            Err(rollback_error) => Err(format!(
                "{error}; failed to roll back refresh transaction: {rollback_error}"
            )),
        },
    }
}

async fn persist_in_transaction(
    connection: &mut SqliteConnection,
    operation_uuid: &str,
    created_at: &str,
    assets: &[RefreshAssetInput],
    transactions: &[RefreshTransactionInput],
    payload_digest: &str,
) -> Result<(), String> {
    ensure_refresh_operations_schema(connection).await?;

    let committed_marker = sqlx::query_as::<_, (Option<String>, Option<String>)>(
        "SELECT created_at, payload_digest FROM refresh_operations
         WHERE operation_uuid = ?",
    )
    .bind(operation_uuid)
    .fetch_optional(&mut *connection)
    .await
    .map_err(|error| format!("failed to query refresh operation marker: {error}"))?;
    if let Some((committed_created_at, committed_digest)) = committed_marker {
        let committed_created_at = match committed_created_at {
            Some(timestamp) => timestamp,
            None => {
                sqlx::query(
                    "UPDATE refresh_operations SET created_at = ?
                     WHERE operation_uuid = ? AND created_at IS NULL",
                )
                .bind(created_at)
                .bind(operation_uuid)
                .execute(&mut *connection)
                .await
                .map_err(|error| {
                    format!("failed to bind legacy refresh operation timestamp: {error}")
                })?;
                created_at.to_string()
            }
        };
        let committed_digest = match committed_digest {
            Some(digest) => digest,
            None => {
                let digest = reconstruct_committed_payload_digest(
                    connection,
                    operation_uuid,
                    &committed_created_at,
                )
                .await?;
                sqlx::query(
                    "UPDATE refresh_operations SET payload_digest = ?
                     WHERE operation_uuid = ? AND payload_digest IS NULL",
                )
                .bind(&digest)
                .bind(operation_uuid)
                .execute(&mut *connection)
                .await
                .map_err(|error| {
                    format!("failed to bind legacy refresh operation marker: {error}")
                })?;
                digest
            }
        };
        if committed_digest == payload_digest {
            return Ok(());
        }
        return Err("operation UUID conflicts with a different refresh payload".to_string());
    }

    let mut asset_ids = HashMap::<AssetIdentity, i64>::with_capacity(assets.len());
    for asset in assets {
        let id = sqlx::query_scalar::<_, i64>(
            "INSERT INTO assets_v2 (
                uuid, createdAt, wallet, asset_type, symbol, amount, value, price
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id",
        )
        .bind(operation_uuid)
        .bind(created_at)
        .bind(&asset.wallet)
        .bind(&asset.asset_type)
        .bind(&asset.symbol)
        .bind(asset.amount)
        .bind(asset.value)
        .bind(asset.price)
        .fetch_one(&mut *connection)
        .await
        .map_err(|error| {
            format!(
                "failed to insert refresh asset {}:{}:{}: {error}",
                asset.asset_type, asset.wallet, asset.symbol
            )
        })?;
        asset_ids.insert(
            identity(&asset.asset_type, &asset.wallet, &asset.symbol),
            id,
        );
    }

    for refresh_transaction in transactions {
        let transaction_identity = identity(
            &refresh_transaction.asset_type,
            &refresh_transaction.wallet,
            &refresh_transaction.symbol,
        );
        let asset_id = asset_ids.get(&transaction_identity).ok_or_else(|| {
            format!(
                "refresh transaction identity {}:{}:{} has no asset in this snapshot",
                refresh_transaction.asset_type,
                refresh_transaction.wallet,
                refresh_transaction.symbol
            )
        })?;

        sqlx::query(
            "INSERT INTO transactions (
                uuid, assetID, asset_type, wallet, symbol, amount, price,
                txnType, txnCreatedAt, createdAt, updatedAt
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(operation_uuid)
        .bind(asset_id)
        .bind(&refresh_transaction.asset_type)
        .bind(&refresh_transaction.wallet)
        .bind(&refresh_transaction.symbol)
        .bind(refresh_transaction.amount)
        .bind(refresh_transaction.price)
        .bind(&refresh_transaction.txn_type)
        .bind(created_at)
        .bind(created_at)
        .bind(created_at)
        .execute(&mut *connection)
        .await
        .map_err(|error| {
            format!(
                "failed to insert refresh transaction {}:{}:{}: {error}",
                refresh_transaction.asset_type,
                refresh_transaction.wallet,
                refresh_transaction.symbol
            )
        })?;
    }

    sqlx::query(
        "INSERT INTO refresh_operations (operation_uuid, created_at, payload_digest)
         VALUES (?, ?, ?)",
    )
    .bind(operation_uuid)
    .bind(created_at)
    .bind(payload_digest)
    .execute(&mut *connection)
    .await
    .map_err(|error| format!("failed to record refresh operation marker: {error}"))?;

    Ok(())
}

async fn ensure_refresh_operations_schema(connection: &mut SqliteConnection) -> Result<(), String> {
    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS refresh_operations (
                operation_uuid TEXT PRIMARY KEY NOT NULL,
                created_at TEXT NOT NULL,
                payload_digest TEXT
            )",
        )
        .await
        .map_err(|error| format!("failed to ensure refresh operation markers: {error}"))?;

    let columns =
        sqlx::query_scalar::<_, String>("SELECT name FROM pragma_table_info('refresh_operations')")
            .fetch_all(&mut *connection)
            .await
            .map_err(|error| format!("failed to inspect refresh operation markers: {error}"))?;
    if !columns.iter().any(|column| column == "created_at") {
        connection
            .execute("ALTER TABLE refresh_operations ADD COLUMN created_at TEXT")
            .await
            .map_err(|error| {
                format!("failed to add refresh operation marker timestamps: {error}")
            })?;
    }
    if !columns.iter().any(|column| column == "payload_digest") {
        connection
            .execute("ALTER TABLE refresh_operations ADD COLUMN payload_digest TEXT")
            .await
            .map_err(|error| format!("failed to upgrade refresh operation markers: {error}"))?;
    }

    connection
        .execute(
            "UPDATE refresh_operations
             SET created_at = (
                 SELECT MAX(createdAt) FROM assets_v2
                 WHERE uuid = refresh_operations.operation_uuid
             )
             WHERE created_at IS NULL
               AND EXISTS (
                   SELECT 1 FROM assets_v2
                   WHERE uuid = refresh_operations.operation_uuid
               )",
        )
        .await
        .map_err(|error| format!("failed to backfill refresh operation timestamps: {error}"))?;

    Ok(())
}

async fn reconstruct_committed_payload_digest(
    connection: &mut SqliteConnection,
    operation_uuid: &str,
    created_at: &str,
) -> Result<String, String> {
    let stored_assets = sqlx::query_as::<_, (String, String, String, f64, f64, f64)>(
        "SELECT asset_type, wallet, symbol, amount, value, price
             FROM assets_v2 WHERE uuid = ? ORDER BY id",
    )
    .bind(operation_uuid)
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("failed to reconstruct legacy refresh operation assets: {error}"))?
    .into_iter()
    .map(
        |(asset_type, wallet, symbol, amount, value, price)| RefreshAssetInput {
            asset_type,
            wallet,
            symbol,
            amount,
            value,
            price,
        },
    )
    .collect::<Vec<_>>();
    let stored_transactions = sqlx::query_as::<_, (String, String, String, f64, f64, String)>(
        "SELECT asset_type, wallet, symbol, amount, price, txnType
             FROM transactions WHERE uuid = ? ORDER BY id",
    )
    .bind(operation_uuid)
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| {
        format!("failed to reconstruct legacy refresh operation transactions: {error}")
    })?
    .into_iter()
    .map(
        |(asset_type, wallet, symbol, amount, price, txn_type)| RefreshTransactionInput {
            asset_type,
            wallet,
            symbol,
            amount,
            price,
            txn_type,
        },
    )
    .collect::<Vec<_>>();

    Ok(payload_digest(
        created_at,
        &stored_assets,
        &stored_transactions,
    ))
}

fn payload_digest(
    created_at: &str,
    assets: &[RefreshAssetInput],
    transactions: &[RefreshTransactionInput],
) -> String {
    let mut digest = Sha256::new();
    hash_bytes(&mut digest, b"track3-refresh-payload-v1");
    hash_bytes(&mut digest, created_at.as_bytes());
    hash_u64(&mut digest, assets.len() as u64);
    for asset in assets {
        hash_bytes(&mut digest, asset.asset_type.as_bytes());
        hash_bytes(&mut digest, asset.wallet.as_bytes());
        hash_bytes(&mut digest, asset.symbol.as_bytes());
        hash_u64(&mut digest, asset.amount.to_bits());
        hash_u64(&mut digest, asset.value.to_bits());
        hash_u64(&mut digest, asset.price.to_bits());
    }
    hash_u64(&mut digest, transactions.len() as u64);
    for transaction in transactions {
        hash_bytes(&mut digest, transaction.asset_type.as_bytes());
        hash_bytes(&mut digest, transaction.wallet.as_bytes());
        hash_bytes(&mut digest, transaction.symbol.as_bytes());
        hash_u64(&mut digest, transaction.amount.to_bits());
        hash_u64(&mut digest, transaction.price.to_bits());
        hash_bytes(&mut digest, transaction.txn_type.as_bytes());
    }
    format!("{:x}", digest.finalize())
}

fn hash_bytes(digest: &mut Sha256, bytes: &[u8]) {
    hash_u64(digest, bytes.len() as u64);
    digest.update(bytes);
}

fn hash_u64(digest: &mut Sha256, value: u64) {
    digest.update(value.to_be_bytes());
}

fn validate_inputs(
    operation_uuid: &str,
    created_at: &str,
    assets: &[RefreshAssetInput],
    transactions: &[RefreshTransactionInput],
) -> Result<(), String> {
    validate_operation_uuid(operation_uuid)?;
    validate_created_at(created_at)?;

    let mut identities = HashSet::with_capacity(assets.len());
    for asset in assets {
        validate_asset(asset)?;
        let asset_identity = identity(&asset.asset_type, &asset.wallet, &asset.symbol);
        if !identities.insert(asset_identity) {
            return Err(format!(
                "duplicate refresh asset identity {}:{}:{}",
                asset.asset_type, asset.wallet, asset.symbol
            ));
        }
    }

    for refresh_transaction in transactions {
        validate_transaction(refresh_transaction)?;
        let transaction_identity = identity(
            &refresh_transaction.asset_type,
            &refresh_transaction.wallet,
            &refresh_transaction.symbol,
        );
        if !identities.contains(&transaction_identity) {
            return Err(format!(
                "refresh transaction identity {}:{}:{} has no matching asset",
                refresh_transaction.asset_type,
                refresh_transaction.wallet,
                refresh_transaction.symbol
            ));
        }
    }

    Ok(())
}

fn validate_operation_uuid(operation_uuid: &str) -> Result<(), String> {
    let parsed = Uuid::parse_str(operation_uuid)
        .map_err(|_| "operation UUID must be a canonical UUID v4".to_string())?;
    if parsed.get_version_num() != 4 || parsed.hyphenated().to_string() != operation_uuid {
        return Err("operation UUID must be a canonical UUID v4".to_string());
    }
    Ok(())
}

fn validate_created_at(created_at: &str) -> Result<(), String> {
    let bytes = created_at.as_bytes();
    if bytes.len() != 24
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || bytes[10] != b'T'
        || bytes[13] != b':'
        || bytes[16] != b':'
        || bytes[19] != b'.'
        || bytes[23] != b'Z'
    {
        return Err(
            "created_at must be a canonical UTC timestamp with millisecond precision".to_string(),
        );
    }

    let year = decimal(bytes, 0, 4);
    let month = decimal(bytes, 5, 2);
    let day = decimal(bytes, 8, 2);
    let hour = decimal(bytes, 11, 2);
    let minute = decimal(bytes, 14, 2);
    let second = decimal(bytes, 17, 2);
    let millis = decimal(bytes, 20, 3);
    let (Some(year), Some(month), Some(day), Some(hour), Some(minute), Some(second), Some(millis)) =
        (year, month, day, hour, minute, second, millis)
    else {
        return Err(
            "created_at must be a canonical UTC timestamp with millisecond precision".to_string(),
        );
    };

    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap_year(year) => 29,
        2 => 28,
        _ => 0,
    };
    if year == 0
        || day == 0
        || day > max_day
        || hour > 23
        || minute > 59
        || second > 59
        || millis > 999
    {
        return Err("created_at contains an invalid UTC date or time".to_string());
    }
    Ok(())
}

fn decimal(bytes: &[u8], start: usize, length: usize) -> Option<u32> {
    bytes
        .get(start..start + length)?
        .iter()
        .try_fold(0_u32, |value, byte| {
            byte.is_ascii_digit()
                .then_some(value * 10 + u32::from(byte - b'0'))
        })
}

fn is_leap_year(year: u32) -> bool {
    year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400))
}

fn validate_asset(asset: &RefreshAssetInput) -> Result<(), String> {
    validate_identity(&asset.asset_type, &asset.symbol)?;
    validate_number(asset.amount, "asset amount", true)?;
    validate_number(asset.value, "asset value", true)?;
    validate_number(asset.price, "asset price", true)
}

fn validate_transaction(transaction: &RefreshTransactionInput) -> Result<(), String> {
    validate_identity(&transaction.asset_type, &transaction.symbol)?;
    if !matches!(transaction.txn_type.as_str(), "buy" | "sell") {
        return Err("refresh transaction txn_type must be buy or sell".to_string());
    }
    validate_number(transaction.amount, "transaction amount", false)?;
    validate_number(transaction.price, "transaction price", true)
}

fn validate_identity(asset_type: &str, symbol: &str) -> Result<(), String> {
    if !matches!(asset_type, "crypto" | "stock") {
        return Err("asset_type must be crypto or stock".to_string());
    }
    if symbol.is_empty() || symbol.trim() != symbol {
        return Err("asset symbol must be non-empty without surrounding whitespace".to_string());
    }
    Ok(())
}

fn validate_number(value: f64, field: &str, allow_zero: bool) -> Result<(), String> {
    if !value.is_finite() {
        return Err(format!("{field} must be finite"));
    }
    if value < 0.0 || (!allow_zero && value == 0.0) {
        return Err(format!(
            "{field} must be {}",
            if allow_zero {
                "non-negative"
            } else {
                "positive"
            }
        ));
    }
    Ok(())
}

fn identity(asset_type: &str, wallet: &str, symbol: &str) -> AssetIdentity {
    (
        asset_type.to_string(),
        wallet.to_string(),
        symbol.to_string(),
    )
}

#[cfg(test)]
mod tests {
    use super::persist_refresh;
    use crate::types::{RefreshAssetInput, RefreshTransactionInput};
    use sqlx::{sqlite::SqliteConnectOptions, Connection, Executor, SqliteConnection};
    use std::{
        fs,
        path::{Path, PathBuf},
    };
    use tokio::runtime::Runtime;
    use uuid::Uuid;

    const OPERATION_UUID: &str = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const SECOND_OPERATION_UUID: &str = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const CREATED_AT: &str = "2026-07-14T08:09:10.123Z";

    struct TestDatabase {
        root: PathBuf,
        path: PathBuf,
    }

    impl TestDatabase {
        async fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("track3-refresh-persistence-{}", Uuid::new_v4()));
            fs::create_dir_all(&root).unwrap();
            let path = root.join("track3.db");
            let mut connection = connect(&path, true).await;
            sqlx::raw_sql(
                "CREATE TABLE assets_v2 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uuid TEXT NOT NULL,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    wallet TEXT NOT NULL,
                    asset_type TEXT NOT NULL DEFAULT 'crypto',
                    symbol TEXT NOT NULL,
                    amount REAL NOT NULL,
                    value REAL NOT NULL,
                    price REAL NOT NULL
                );
                CREATE UNIQUE INDEX unique_uuid_asset_type_symbol_wallet
                    ON assets_v2 (uuid, asset_type, symbol, wallet);
                CREATE TABLE transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uuid TEXT NOT NULL,
                    assetID INTEGER NOT NULL,
                    asset_type TEXT NOT NULL DEFAULT 'crypto',
                    wallet TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    amount REAL NOT NULL,
                    price REAL NOT NULL,
                    txnType TEXT NOT NULL,
                    txnCreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                );",
            )
            .execute(&mut connection)
            .await
            .unwrap();
            connection.close().await.unwrap();
            Self { root, path }
        }

        async fn execute(&self, sql: &str) {
            let mut connection = connect(&self.path, false).await;
            connection.execute(sql).await.unwrap();
            connection.close().await.unwrap();
        }

        async fn count(&self, table: &str) -> i64 {
            let mut connection = connect(&self.path, false).await;
            let count = match table {
                "assets_v2" | "transactions" => {
                    sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM {table}"))
                        .fetch_one(&mut connection)
                        .await
                        .unwrap()
                }
                "refresh_operations" => {
                    let exists = sqlx::query_scalar::<_, i64>(
                        "SELECT COUNT(*) FROM sqlite_master
                         WHERE type = 'table' AND name = 'refresh_operations'",
                    )
                    .fetch_one(&mut connection)
                    .await
                    .unwrap();
                    if exists == 0 {
                        0
                    } else {
                        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM refresh_operations")
                            .fetch_one(&mut connection)
                            .await
                            .unwrap()
                    }
                }
                _ => panic!("unexpected table {table}"),
            };
            connection.close().await.unwrap();
            count
        }

        async fn marker_digest(&self, operation_uuid: &str) -> Option<String> {
            let mut connection = connect(&self.path, false).await;
            let digest = sqlx::query_scalar::<_, Option<String>>(
                "SELECT payload_digest FROM refresh_operations
                 WHERE operation_uuid = ?",
            )
            .bind(operation_uuid)
            .fetch_one(&mut connection)
            .await
            .unwrap();
            connection.close().await.unwrap();
            digest
        }

        async fn marker_created_at(&self, operation_uuid: &str) -> Option<String> {
            let mut connection = connect(&self.path, false).await;
            let created_at = sqlx::query_scalar::<_, Option<String>>(
                "SELECT created_at FROM refresh_operations
                 WHERE operation_uuid = ?",
            )
            .bind(operation_uuid)
            .fetch_one(&mut connection)
            .await
            .unwrap();
            connection.close().await.unwrap();
            created_at
        }
    }

    impl Drop for TestDatabase {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    async fn connect(path: &Path, create_if_missing: bool) -> SqliteConnection {
        SqliteConnection::connect_with(
            &SqliteConnectOptions::new()
                .filename(path)
                .create_if_missing(create_if_missing),
        )
        .await
        .unwrap()
    }

    fn asset(wallet: &str, symbol: &str) -> RefreshAssetInput {
        RefreshAssetInput {
            asset_type: "crypto".to_string(),
            wallet: wallet.to_string(),
            symbol: symbol.to_string(),
            amount: 2.0,
            value: 200.0,
            price: 100.0,
        }
    }

    fn transaction(wallet: &str, symbol: &str) -> RefreshTransactionInput {
        RefreshTransactionInput {
            asset_type: "crypto".to_string(),
            wallet: wallet.to_string(),
            symbol: symbol.to_string(),
            amount: 2.0,
            price: 100.0,
            txn_type: "buy".to_string(),
        }
    }

    async fn persist(
        database: &TestDatabase,
        operation_uuid: &str,
        created_at: &str,
        assets: &[RefreshAssetInput],
        transactions: &[RefreshTransactionInput],
    ) -> Result<(), String> {
        persist_refresh(
            &database.path,
            operation_uuid,
            created_at,
            assets,
            transactions,
        )
        .await
    }

    #[test]
    fn transaction_insert_failure_rolls_back_the_snapshot() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;
            database
                .execute(
                    "CREATE TRIGGER fail_transaction
                     BEFORE INSERT ON transactions
                     BEGIN
                       SELECT RAISE(ABORT, 'forced transaction failure');
                     END;",
                )
                .await;

            let error = persist(
                &database,
                OPERATION_UUID,
                CREATED_AT,
                &[asset("wallet-a", "BTC")],
                &[transaction("wallet-a", "BTC")],
            )
            .await
            .unwrap_err();

            assert!(error.contains("transaction"), "{error}");
            assert_eq!(database.count("assets_v2").await, 0);
            assert_eq!(database.count("transactions").await, 0);
            assert_eq!(database.count("refresh_operations").await, 0);
        });
    }

    #[test]
    fn retrying_a_committed_operation_uuid_is_idempotent() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;
            let assets = [asset("wallet-a", "BTC")];
            let transactions = [transaction("wallet-a", "BTC")];

            persist(
                &database,
                OPERATION_UUID,
                CREATED_AT,
                &assets,
                &transactions,
            )
            .await
            .unwrap();
            persist(
                &database,
                OPERATION_UUID,
                CREATED_AT,
                &assets,
                &transactions,
            )
            .await
            .unwrap();

            assert_eq!(database.count("assets_v2").await, 1);
            assert_eq!(database.count("transactions").await, 1);
            assert_eq!(database.count("refresh_operations").await, 1);
        });
    }

    #[test]
    fn committed_uuid_rejects_different_empty_payload_timestamp() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;

            persist(&database, OPERATION_UUID, CREATED_AT, &[], &[])
                .await
                .unwrap();
            let error = persist(
                &database,
                OPERATION_UUID,
                "2026-07-14T08:09:11.123Z",
                &[],
                &[],
            )
            .await
            .unwrap_err();

            assert!(error.contains("conflicts"), "{error}");
            assert!(!error.contains(CREATED_AT), "{error}");
            assert_eq!(database.count("assets_v2").await, 0);
            assert_eq!(database.count("transactions").await, 0);
            assert_eq!(database.count("refresh_operations").await, 1);
        });
    }

    #[test]
    fn committed_uuid_rejects_changed_assets_transactions_and_order() {
        Runtime::new().unwrap().block_on(async {
            let changed_asset_database = TestDatabase::new().await;
            let assets = [asset("wallet-a", "BTC")];
            let transactions = [transaction("wallet-a", "BTC")];
            persist(
                &changed_asset_database,
                OPERATION_UUID,
                CREATED_AT,
                &assets,
                &transactions,
            )
            .await
            .unwrap();
            let mut changed_asset = asset("wallet-a", "BTC");
            changed_asset.amount = 3.0;
            let asset_error = persist(
                &changed_asset_database,
                OPERATION_UUID,
                CREATED_AT,
                &[changed_asset],
                &transactions,
            )
            .await
            .unwrap_err();
            assert!(asset_error.contains("conflicts"), "{asset_error}");
            assert!(!asset_error.contains("BTC"), "{asset_error}");

            let changed_transaction_database = TestDatabase::new().await;
            persist(
                &changed_transaction_database,
                OPERATION_UUID,
                CREATED_AT,
                &assets,
                &transactions,
            )
            .await
            .unwrap();
            let mut changed_transaction = transaction("wallet-a", "BTC");
            changed_transaction.price = 101.0;
            let transaction_error = persist(
                &changed_transaction_database,
                OPERATION_UUID,
                CREATED_AT,
                &assets,
                &[changed_transaction],
            )
            .await
            .unwrap_err();
            assert!(
                transaction_error.contains("conflicts"),
                "{transaction_error}"
            );
            assert!(!transaction_error.contains("BTC"), "{transaction_error}");

            let reordered_database = TestDatabase::new().await;
            let ordered_assets = [asset("wallet-a", "BTC"), asset("wallet-b", "ETH")];
            persist(
                &reordered_database,
                OPERATION_UUID,
                CREATED_AT,
                &ordered_assets,
                &[],
            )
            .await
            .unwrap();
            let reordered_assets = [asset("wallet-b", "ETH"), asset("wallet-a", "BTC")];
            let order_error = persist(
                &reordered_database,
                OPERATION_UUID,
                CREATED_AT,
                &reordered_assets,
                &[],
            )
            .await
            .unwrap_err();
            assert!(order_error.contains("conflicts"), "{order_error}");

            let reordered_transactions_database = TestDatabase::new().await;
            let ordered_transactions = [
                transaction("wallet-a", "BTC"),
                transaction("wallet-b", "ETH"),
            ];
            persist(
                &reordered_transactions_database,
                OPERATION_UUID,
                CREATED_AT,
                &ordered_assets,
                &ordered_transactions,
            )
            .await
            .unwrap();
            let reordered_transactions = [
                transaction("wallet-b", "ETH"),
                transaction("wallet-a", "BTC"),
            ];
            let transaction_order_error = persist(
                &reordered_transactions_database,
                OPERATION_UUID,
                CREATED_AT,
                &ordered_assets,
                &reordered_transactions,
            )
            .await
            .unwrap_err();
            assert!(
                transaction_order_error.contains("conflicts"),
                "{transaction_order_error}"
            );

            assert_eq!(changed_asset_database.count("assets_v2").await, 1);
            assert_eq!(changed_asset_database.count("transactions").await, 1);
            assert_eq!(reordered_database.count("assets_v2").await, 2);
        });
    }

    #[test]
    fn legacy_marker_is_bound_to_its_committed_payload_on_retry() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;
            database
                .execute(
                    "CREATE TABLE refresh_operations (
                        operation_uuid TEXT PRIMARY KEY NOT NULL,
                        created_at TEXT NOT NULL
                    )",
                )
                .await;
            database
                .execute(
                    "INSERT INTO assets_v2 (
                        uuid, createdAt, wallet, asset_type, symbol,
                        amount, value, price
                     ) VALUES (
                        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                        '2026-07-14T08:09:10.123Z',
                        'wallet-a', 'crypto', 'BTC', 2, 200, 100
                     )",
                )
                .await;
            database
                .execute(
                    "INSERT INTO transactions (
                        uuid, assetID, asset_type, wallet, symbol, amount,
                        price, txnType, txnCreatedAt, createdAt, updatedAt
                     ) VALUES (
                        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                        1, 'crypto', 'wallet-a', 'BTC', 2, 100, 'buy',
                        '2026-07-14T08:09:10.123Z',
                        '2026-07-14T08:09:10.123Z',
                        '2026-07-14T08:09:10.123Z'
                     )",
                )
                .await;
            database
                .execute(
                    "INSERT INTO refresh_operations (operation_uuid, created_at)
                     VALUES (
                        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                        '2026-07-14T08:09:10.123Z'
                     )",
                )
                .await;

            persist(
                &database,
                OPERATION_UUID,
                CREATED_AT,
                &[asset("wallet-a", "BTC")],
                &[transaction("wallet-a", "BTC")],
            )
            .await
            .unwrap();

            let digest = database.marker_digest(OPERATION_UUID).await.unwrap();
            assert_eq!(digest.len(), 64);
            assert_eq!(database.count("assets_v2").await, 1);
            assert_eq!(database.count("transactions").await, 1);

            let mut changed_asset = asset("wallet-a", "BTC");
            changed_asset.amount = 3.0;
            let error = persist(
                &database,
                OPERATION_UUID,
                CREATED_AT,
                &[changed_asset],
                &[transaction("wallet-a", "BTC")],
            )
            .await
            .unwrap_err();
            assert!(error.contains("conflicts"), "{error}");
        });
    }

    #[test]
    fn operation_uuid_only_marker_is_upgraded_and_bound_idempotently() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;
            database
                .execute(
                    "CREATE TABLE refresh_operations (
                        operation_uuid TEXT PRIMARY KEY NOT NULL
                    );
                    INSERT INTO refresh_operations (operation_uuid)
                    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');",
                )
                .await;

            persist(&database, OPERATION_UUID, CREATED_AT, &[], &[])
                .await
                .unwrap();
            persist(&database, OPERATION_UUID, CREATED_AT, &[], &[])
                .await
                .unwrap();

            assert_eq!(
                database.marker_created_at(OPERATION_UUID).await.as_deref(),
                Some(CREATED_AT)
            );
            assert_eq!(
                database.marker_digest(OPERATION_UUID).await.unwrap().len(),
                64
            );
            assert_eq!(database.count("refresh_operations").await, 1);

            let error = persist(
                &database,
                OPERATION_UUID,
                "2026-07-14T08:09:11.123Z",
                &[],
                &[],
            )
            .await
            .unwrap_err();
            assert!(error.contains("conflicts"), "{error}");
            assert_eq!(
                database.marker_created_at(OPERATION_UUID).await.as_deref(),
                Some(CREATED_AT)
            );
        });
    }

    #[test]
    fn missing_marker_timestamp_is_backfilled_from_its_existing_snapshot() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;
            database
                .execute(
                    "CREATE TABLE refresh_operations (
                        operation_uuid TEXT PRIMARY KEY NOT NULL
                    )",
                )
                .await;
            database
                .execute(
                    "INSERT INTO assets_v2 (
                        uuid, createdAt, wallet, asset_type, symbol,
                        amount, value, price
                     ) VALUES (
                        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                        '2026-07-14T08:09:10.123Z',
                        'wallet-a', 'crypto', 'BTC', 2, 200, 100
                     )",
                )
                .await;
            database
                .execute(
                    "INSERT INTO refresh_operations (operation_uuid)
                     VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
                )
                .await;

            persist(
                &database,
                SECOND_OPERATION_UUID,
                "2026-07-14T08:09:11.123Z",
                &[],
                &[],
            )
            .await
            .unwrap();

            assert_eq!(
                database.marker_created_at(OPERATION_UUID).await.as_deref(),
                Some(CREATED_AT)
            );
            assert_eq!(
                database
                    .marker_created_at(SECOND_OPERATION_UUID)
                    .await
                    .as_deref(),
                Some("2026-07-14T08:09:11.123Z")
            );
        });
    }

    #[test]
    fn concurrent_same_uuid_calls_are_all_idempotent_successes() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;
            database
                .execute(
                    "CREATE TABLE refresh_operations (
                        operation_uuid TEXT PRIMARY KEY NOT NULL,
                        created_at TEXT NOT NULL,
                        payload_digest TEXT
                    );",
                )
                .await;
            let assets = (0..100)
                .map(|index| asset("wallet-a", &format!("COIN-{index}")))
                .collect::<Vec<_>>();
            let tasks = (0..4)
                .map(|_| {
                    let path = database.path.clone();
                    let assets = assets.clone();
                    tokio::spawn(async move {
                        persist_refresh(&path, OPERATION_UUID, CREATED_AT, &assets, &[]).await
                    })
                })
                .collect::<Vec<_>>();

            for task in tasks {
                task.await.unwrap().unwrap();
            }

            assert_eq!(database.count("assets_v2").await, 100);
            assert_eq!(database.count("transactions").await, 0);
            assert_eq!(database.count("refresh_operations").await, 1);
        });
    }

    #[test]
    fn concurrent_different_uuid_calls_both_commit() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;
            database
                .execute(
                    "CREATE TABLE refresh_operations (
                        operation_uuid TEXT PRIMARY KEY NOT NULL,
                        created_at TEXT NOT NULL,
                        payload_digest TEXT
                    );",
                )
                .await;
            let first_path = database.path.clone();
            let second_path = database.path.clone();
            let first_assets = (0..100)
                .map(|index| asset("wallet-a", &format!("FIRST-{index}")))
                .collect::<Vec<_>>();
            let second_assets = (0..100)
                .map(|index| asset("wallet-b", &format!("SECOND-{index}")))
                .collect::<Vec<_>>();
            let first = tokio::spawn(async move {
                persist_refresh(&first_path, OPERATION_UUID, CREATED_AT, &first_assets, &[]).await
            });
            let second = tokio::spawn(async move {
                persist_refresh(
                    &second_path,
                    SECOND_OPERATION_UUID,
                    CREATED_AT,
                    &second_assets,
                    &[],
                )
                .await
            });

            first.await.unwrap().unwrap();
            second.await.unwrap().unwrap();

            assert_eq!(database.count("assets_v2").await, 200);
            assert_eq!(database.count("transactions").await, 0);
            assert_eq!(database.count("refresh_operations").await, 2);
        });
    }

    #[test]
    fn inserted_transactions_reference_inserted_asset_ids() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;
            database
                .execute(
                    "INSERT INTO assets_v2 (
                        uuid, createdAt, wallet, asset_type, symbol,
                        amount, value, price
                     ) VALUES (
                        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                        '2026-07-13T08:09:10.123Z',
                        'wallet-a', 'crypto', 'BTC', 1, 100, 100
                     );",
                )
                .await;

            persist(
                &database,
                OPERATION_UUID,
                CREATED_AT,
                &[asset("wallet-a", "BTC")],
                &[transaction("wallet-a", "BTC")],
            )
            .await
            .unwrap();

            let mut connection = connect(&database.path, false).await;
            let transaction_asset_id: i64 = sqlx::query_scalar("SELECT assetID FROM transactions")
                .fetch_one(&mut connection)
                .await
                .unwrap();
            let inserted_asset_id: i64 =
                sqlx::query_scalar("SELECT id FROM assets_v2 WHERE uuid = ?")
                    .bind(OPERATION_UUID)
                    .fetch_one(&mut connection)
                    .await
                    .unwrap();
            assert_eq!(transaction_asset_id, inserted_asset_id);
            assert_ne!(transaction_asset_id, 1);
        });
    }

    #[test]
    fn rejects_invalid_payloads_before_writing() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;

            let mut invalid_asset = asset("wallet-a", "BTC");
            invalid_asset.amount = f64::NAN;
            let non_finite = persist(&database, OPERATION_UUID, CREATED_AT, &[invalid_asset], &[])
                .await
                .unwrap_err();
            assert!(non_finite.contains("finite"), "{non_finite}");

            let mut invalid_transaction = transaction("wallet-a", "BTC");
            invalid_transaction.txn_type = "transfer".to_string();
            let invalid_type = persist(
                &database,
                OPERATION_UUID,
                CREATED_AT,
                &[asset("wallet-a", "BTC")],
                &[invalid_transaction],
            )
            .await
            .unwrap_err();
            assert!(invalid_type.contains("txn_type"), "{invalid_type}");

            assert_eq!(database.count("assets_v2").await, 0);
            assert_eq!(database.count("transactions").await, 0);
        });
    }

    #[test]
    fn empty_payload_is_a_successful_idempotent_no_op() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;

            persist(&database, OPERATION_UUID, CREATED_AT, &[], &[])
                .await
                .unwrap();
            persist(&database, OPERATION_UUID, CREATED_AT, &[], &[])
                .await
                .unwrap();

            assert_eq!(database.count("assets_v2").await, 0);
            assert_eq!(database.count("transactions").await, 0);
            assert_eq!(database.count("refresh_operations").await, 1);
        });
    }

    #[test]
    fn transactions_without_assets_are_rejected_without_writes() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;

            let error = persist(
                &database,
                OPERATION_UUID,
                CREATED_AT,
                &[],
                &[transaction("wallet-a", "BTC")],
            )
            .await
            .unwrap_err();

            assert!(error.contains("identity"), "{error}");
            assert_eq!(database.count("assets_v2").await, 0);
            assert_eq!(database.count("transactions").await, 0);
            assert_eq!(database.count("refresh_operations").await, 0);
        });
    }

    #[test]
    fn rejects_ambiguous_or_missing_transaction_identities() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;
            let duplicate_assets = [asset("wallet-a", "BTC"), asset("wallet-a", "BTC")];
            let ambiguous = persist(
                &database,
                OPERATION_UUID,
                CREATED_AT,
                &duplicate_assets,
                &[],
            )
            .await
            .unwrap_err();
            assert!(ambiguous.contains("duplicate"), "{ambiguous}");

            let missing = persist(
                &database,
                OPERATION_UUID,
                CREATED_AT,
                &[asset("wallet-a", "BTC")],
                &[transaction("wallet-b", "ETH")],
            )
            .await
            .unwrap_err();
            assert!(missing.contains("identity"), "{missing}");

            assert_eq!(database.count("assets_v2").await, 0);
            assert_eq!(database.count("transactions").await, 0);
            assert_eq!(database.count("refresh_operations").await, 0);
        });
    }

    #[test]
    fn rejects_noncanonical_uuid_and_timestamp_fields() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;
            let assets = [asset("wallet-a", "BTC")];

            for invalid_uuid in [
                "not-a-uuid",
                "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
                "aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa",
            ] {
                let error = persist(&database, invalid_uuid, CREATED_AT, &assets, &[])
                    .await
                    .unwrap_err();
                assert!(error.contains("UUID"), "{error}");
            }

            for invalid_time in [
                "",
                "2026-07-14 08:09:10",
                "2026-02-30T08:09:10.123Z",
                "2026-07-14T25:09:10.123Z",
            ] {
                let error = persist(&database, OPERATION_UUID, invalid_time, &assets, &[])
                    .await
                    .unwrap_err();
                assert!(error.contains("created_at"), "{error}");
            }

            assert_eq!(database.count("assets_v2").await, 0);
        });
    }

    #[test]
    fn database_errors_never_leave_partial_assets() {
        Runtime::new().unwrap().block_on(async {
            let database = TestDatabase::new().await;
            database
                .execute(
                    "CREATE TRIGGER fail_second_asset
                     BEFORE INSERT ON assets_v2
                     WHEN NEW.symbol = 'FAIL'
                     BEGIN
                       SELECT RAISE(ABORT, 'forced asset failure');
                     END;",
                )
                .await;

            let error = persist(
                &database,
                OPERATION_UUID,
                CREATED_AT,
                &[asset("wallet-a", "BTC"), asset("wallet-b", "FAIL")],
                &[],
            )
            .await
            .unwrap_err();

            assert!(error.contains("asset"), "{error}");
            assert_eq!(database.count("assets_v2").await, 0);
            assert_eq!(database.count("refresh_operations").await, 0);
        });
    }
}
