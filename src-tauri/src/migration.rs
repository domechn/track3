use std::{collections::HashMap, fs, path::Path};

use indexmap::IndexSet;
use sqlx::{
    sqlite::SqliteConnectOptions, Connection, Executor, FromRow, Row, Sqlite, SqliteConnection,
    Transaction as SqliteTransaction,
};
use uuid::Uuid;
use version_compare::{compare_to, Cmp};

use crate::types::AssetsV1;

static CLIENT_ID_CONFIGURATION_ID: i32 = 998;
static VERSION_CONFIGURATION_ID: i32 = 999;

static ASSETS_V2_TABLE_NAME: &str = "assets_v2";
static TRANSACTION_TABLE_NAME: &str = "transactions";

#[derive(Clone, Debug, FromRow)]
struct MigrationAsset {
    id: i32,
    uuid: String,
    created_at: String,
    symbol: String,
    amount: f64,
    value: f64,
    price: f64,
    wallet: Option<String>,
    asset_type: String,
}

#[derive(Debug, FromRow)]
struct MigrationAssetPrice {
    asset_id: i32,
    price: f64,
}

#[derive(Debug, FromRow)]
struct ExistingDestinationAsset {
    id: i64,
    uuid: String,
    created_at: Option<String>,
    wallet: String,
    asset_type: String,
    symbol: String,
    amount: f64,
    value: f64,
    price: f64,
}

#[derive(Debug)]
struct GeneratedTransaction {
    uuid: String,
    asset_id: i32,
    asset_type: String,
    wallet: String,
    symbol: String,
    amount: f64,
    price: f64,
    txn_type: String,
    txn_created_at: String,
    created_at: String,
}

fn asset_v1_model_to_v2(
    uuid: String,
    created_at: String,
    symbol: Option<String>,
    amount: Option<f64>,
    value: Option<f64>,
) -> Option<MigrationAsset> {
    let (Some(symbol), Some(amount), Some(value)) = (symbol, amount, value) else {
        return None;
    };

    if amount == 0.0 || value == 0.0 {
        return None;
    }

    Some(MigrationAsset {
        id: 0,
        uuid,
        symbol,
        amount,
        value,
        price: value / amount,
        created_at,
        wallet: None,
        asset_type: "crypto".to_string(),
    })
}

fn move_data_from_assets_to_v2(data: Vec<AssetsV1>) -> Vec<MigrationAsset> {
    let mut v2_data = Vec::new();
    for row in data {
        let mut v2_data_item = Vec::<MigrationAsset>::new();
        let uuid = Uuid::new_v4();

        let ca = row.createdAt;

        for (symbol, amount, value) in [
            (row.top01, row.amount01, row.value01),
            (row.top02, row.amount02, row.value02),
            (row.top03, row.amount03, row.value03),
            (row.top04, row.amount04, row.value04),
            (row.top05, row.amount05, row.value05),
            (row.top06, row.amount06, row.value06),
            (row.top07, row.amount07, row.value07),
            (row.top08, row.amount08, row.value08),
            (row.top09, row.amount09, row.value09),
            (row.top10, row.amount10, row.value10),
        ] {
            if let Some(asset) =
                asset_v1_model_to_v2(uuid.to_string(), ca.clone(), symbol, amount, value)
            {
                v2_data_item.push(asset);
            }
        }

        let mut found = false;
        let data_others = asset_v1_model_to_v2(
            uuid.to_string(),
            ca.clone(),
            row.topOthers,
            row.valueOthers,
            row.valueOthers,
        );
        if let Some(data_others) = data_others {
            for item in &mut v2_data_item {
                if item.symbol == "USDT" || item.symbol == "USDC" {
                    item.amount += data_others.amount;
                    item.value += data_others.value;
                    found = true;
                    break;
                }
            }

            if !found {
                v2_data.push(MigrationAsset {
                    id: 0,
                    uuid: uuid.to_string(),
                    symbol: "USDT".to_string(),
                    amount: data_others.amount,
                    value: data_others.value,
                    price: 1.0,
                    created_at: ca.clone(),
                    wallet: None,
                    asset_type: "crypto".to_string(),
                });
            }
        }

        v2_data.extend(v2_data_item);
    }
    v2_data
}

type MigrationResult<T> = Result<T, String>;

fn read_migration_sql(resource_dir: &Path, relative_path: &str) -> MigrationResult<String> {
    let path = resource_dir.join("migrations").join(relative_path);
    fs::read_to_string(&path)
        .map_err(|error| format!("failed to read migration {}: {error}", path.display()))
}

async fn migration_table_exists(
    transaction: &mut SqliteTransaction<'_, Sqlite>,
    table_name: &str,
) -> MigrationResult<bool> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master
         WHERE type = 'table' AND name = ?",
    )
    .bind(table_name)
    .fetch_one(&mut **transaction)
    .await
    .map_err(|error| format!("failed to inspect table {table_name}: {error}"))?;
    Ok(count > 0)
}

async fn migration_column_exists(
    transaction: &mut SqliteTransaction<'_, Sqlite>,
    table_name: &str,
    column_name: &str,
) -> MigrationResult<bool> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?")
        .bind(table_name)
        .bind(column_name)
        .fetch_one(&mut **transaction)
        .await
        .map_err(|error| format!("failed to inspect column {table_name}.{column_name}: {error}"))?;
    Ok(count > 0)
}

async fn connection_table_exists(
    connection: &mut SqliteConnection,
    table_name: &str,
) -> MigrationResult<bool> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master
         WHERE type = 'table' AND name = ?",
    )
    .bind(table_name)
    .fetch_one(&mut *connection)
    .await
    .map_err(|error| format!("failed to inspect table {table_name}: {error}"))?;
    Ok(count > 0)
}

async fn connection_column_exists(
    connection: &mut SqliteConnection,
    table_name: &str,
    column_name: &str,
) -> MigrationResult<bool> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?")
        .bind(table_name)
        .bind(column_name)
        .fetch_one(&mut *connection)
        .await
        .map_err(|error| format!("failed to inspect column {table_name}.{column_name}: {error}"))?;
    Ok(count > 0)
}

async fn repair_index(
    transaction: &mut SqliteTransaction<'_, Sqlite>,
    table_name: &str,
    index_name: &str,
    unique: bool,
    columns: &[(&str, bool)],
) -> MigrationResult<()> {
    let index_owner: Option<String> = sqlx::query_scalar(
        "SELECT tbl_name FROM sqlite_master
         WHERE type = 'index' AND name = ?",
    )
    .bind(index_name)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(|error| format!("failed to inspect index {index_name}: {error}"))?;

    let mut index_matches = index_owner.as_deref() == Some(table_name);
    if index_matches {
        let index_properties =
            sqlx::query("SELECT \"unique\", partial FROM pragma_index_list(?) WHERE name = ?")
                .bind(table_name)
                .bind(index_name)
                .fetch_optional(&mut **transaction)
                .await
                .map_err(|error| {
                    format!("failed to inspect index uniqueness for {index_name}: {error}")
                })?;
        let actual_columns = sqlx::query(
            "SELECT name, \"desc\", coll
                 FROM pragma_index_xinfo(?)
                 WHERE key = 1
                 ORDER BY seqno",
        )
        .bind(index_name)
        .fetch_all(&mut **transaction)
        .await
        .map_err(|error| format!("failed to inspect index columns for {index_name}: {error}"))?;
        let columns_match = actual_columns.len() == columns.len()
            && actual_columns.iter().zip(columns).all(
                |(actual, (expected_name, expected_descending))| {
                    actual
                        .try_get::<Option<String>, _>("name")
                        .ok()
                        .flatten()
                        .as_deref()
                        == Some(*expected_name)
                        && actual.try_get::<i64, _>("desc").ok()
                            == Some(i64::from(*expected_descending))
                        && actual
                            .try_get::<String, _>("coll")
                            .is_ok_and(|collation| collation.eq_ignore_ascii_case("BINARY"))
                },
            );
        index_matches = index_properties.is_some_and(|properties| {
            properties.get::<i64, _>("unique") == i64::from(unique)
                && properties.get::<i64, _>("partial") == 0
        }) && columns_match;
    }

    if index_matches {
        return Ok(());
    }

    transaction
        .execute(format!("DROP INDEX IF EXISTS \"{index_name}\"").as_str())
        .await
        .map_err(|error| format!("failed to drop invalid index {index_name}: {error}"))?;
    let unique_keyword = if unique { "UNIQUE " } else { "" };
    transaction
        .execute(
            format!(
                "CREATE {unique_keyword}INDEX \"{index_name}\" ON \"{table_name}\" ({})",
                columns
                    .iter()
                    .map(|(column, descending)| {
                        format!("\"{column}\"{}", if *descending { " DESC" } else { "" })
                    })
                    .collect::<Vec<_>>()
                    .join(", ")
            )
            .as_str(),
        )
        .await
        .map_err(|error| format!("failed to create index {index_name}: {error}"))?;
    Ok(())
}

async fn reject_normalized_wallet_conflicts(
    transaction: &mut SqliteTransaction<'_, Sqlite>,
    with_asset_type: bool,
) -> MigrationResult<()> {
    let query = if with_asset_type {
        "SELECT uuid, asset_type, symbol, COALESCE(wallet, '') AS normalized_wallet,
                GROUP_CONCAT(id, ',') AS conflicting_ids
         FROM assets_v2
         GROUP BY uuid, asset_type, symbol, COALESCE(wallet, '')
         HAVING COUNT(*) > 1
         ORDER BY MIN(id)
         LIMIT 1"
    } else {
        "SELECT uuid, 'crypto' AS asset_type, symbol,
                COALESCE(wallet, '') AS normalized_wallet,
                GROUP_CONCAT(id, ',') AS conflicting_ids
         FROM assets_v2
         GROUP BY uuid, symbol, COALESCE(wallet, '')
         HAVING COUNT(*) > 1
         ORDER BY MIN(id)
         LIMIT 1"
    };
    let conflict = sqlx::query(query)
        .fetch_optional(&mut **transaction)
        .await
        .map_err(|error| format!("failed to inspect normalized wallet conflicts: {error}"))?;
    if let Some(conflict) = conflict {
        return Err(format!(
            "conflicting assets_v2 rows {} normalize to uuid={}, asset_type={}, symbol={}, wallet={}",
            conflict.get::<String, _>("conflicting_ids"),
            conflict.get::<String, _>("uuid"),
            conflict.get::<String, _>("asset_type"),
            conflict.get::<String, _>("symbol"),
            conflict.get::<String, _>("normalized_wallet"),
        ));
    }
    Ok(())
}

async fn normalize_wallets_and_repair_assets_indexes(
    transaction: &mut SqliteTransaction<'_, Sqlite>,
) -> MigrationResult<()> {
    let with_asset_type =
        migration_column_exists(transaction, ASSETS_V2_TABLE_NAME, "asset_type").await?;
    reject_normalized_wallet_conflicts(transaction, with_asset_type).await?;
    transaction
        .execute("UPDATE assets_v2 SET wallet = '' WHERE wallet IS NULL")
        .await
        .map_err(|error| format!("failed to normalize assets_v2 wallets: {error}"))?;

    if with_asset_type {
        transaction
            .execute("DROP INDEX IF EXISTS unique_uuid_symbol_amount_wallet")
            .await
            .map_err(|error| format!("failed to drop legacy assets_v2 index: {error}"))?;
        repair_index(
            transaction,
            ASSETS_V2_TABLE_NAME,
            "unique_uuid_asset_type_symbol_wallet",
            true,
            &[
                ("uuid", false),
                ("asset_type", false),
                ("symbol", false),
                ("wallet", false),
            ],
        )
        .await?;
    } else {
        transaction
            .execute("DROP INDEX IF EXISTS unique_uuid_asset_type_symbol_wallet")
            .await
            .map_err(|error| format!("failed to drop modern assets_v2 index: {error}"))?;
        repair_index(
            transaction,
            ASSETS_V2_TABLE_NAME,
            "unique_uuid_symbol_amount_wallet",
            true,
            &[("uuid", false), ("symbol", false), ("wallet", false)],
        )
        .await?;
    }
    repair_index(
        transaction,
        ASSETS_V2_TABLE_NAME,
        "symbol_idx",
        false,
        &[("symbol", false)],
    )
    .await?;
    repair_index(
        transaction,
        ASSETS_V2_TABLE_NAME,
        "createdAt_idx",
        false,
        &[("createdAt", false)],
    )
    .await
}

async fn write_migration_version(
    transaction: &mut SqliteTransaction<'_, Sqlite>,
    version: &str,
) -> MigrationResult<()> {
    sqlx::query(
        "INSERT INTO configuration (id, data) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    )
    .bind(VERSION_CONFIGURATION_ID)
    .bind(version)
    .execute(&mut **transaction)
    .await
    .map_err(|error| format!("failed to record migration version {version}: {error}"))?;
    Ok(())
}

async fn load_recorded_database_version(
    connection: &mut SqliteConnection,
) -> MigrationResult<Option<String>> {
    let version: Option<String> = sqlx::query_scalar("SELECT data FROM configuration WHERE id = ?")
        .bind(VERSION_CONFIGURATION_ID)
        .fetch_optional(&mut *connection)
        .await
        .map_err(|error| format!("failed to load database version: {error}"))?;
    Ok(version)
}

async fn infer_database_version(connection: &mut SqliteConnection) -> MigrationResult<String> {
    if connection_table_exists(connection, "assets").await? {
        return Ok("0.1.0".to_string());
    }
    if connection_table_exists(connection, "chat_sessions").await? {
        return Ok("0.8.0".to_string());
    }
    if connection_column_exists(connection, ASSETS_V2_TABLE_NAME, "asset_type").await?
        || connection_column_exists(connection, TRANSACTION_TABLE_NAME, "asset_type").await?
    {
        return Ok("0.7.0".to_string());
    }
    if connection_table_exists(connection, TRANSACTION_TABLE_NAME).await? {
        return Ok("0.5.0".to_string());
    }
    if connection_table_exists(connection, "asset_prices").await? {
        return Ok("0.4.0".to_string());
    }
    if connection_column_exists(connection, ASSETS_V2_TABLE_NAME, "wallet").await? {
        return Ok("0.3.0".to_string());
    }
    if connection_table_exists(connection, ASSETS_V2_TABLE_NAME).await? {
        return Ok("0.2.0".to_string());
    }
    Err("cannot infer database version from schema without configuration ID 999".to_string())
}

async fn load_database_version(connection: &mut SqliteConnection) -> MigrationResult<String> {
    match load_recorded_database_version(connection).await? {
        Some(version) => Ok(version),
        None => infer_database_version(connection).await,
    }
}

fn version_is_less(current: &str, target: &str) -> MigrationResult<bool> {
    compare_to(current, target, Cmp::Lt)
        .map_err(|_| format!("cannot compare database version {current} with {target}"))
}

fn version_is_greater(current: &str, target: &str) -> MigrationResult<bool> {
    compare_to(current, target, Cmp::Gt)
        .map_err(|_| format!("cannot compare database version {current} with {target}"))
}

fn destination_matches_expected_conversion(
    destination: &ExistingDestinationAsset,
    expected: &MigrationAsset,
) -> bool {
    destination.created_at.as_deref() == Some(expected.created_at.as_str())
        && destination.wallet.is_empty()
        && destination.asset_type == expected.asset_type
        && destination.symbol == expected.symbol
        && destination.amount == expected.amount
        && destination.value == expected.value
        && destination.price == expected.price
}

async fn validate_v1_destination_subset(
    transaction: &mut SqliteTransaction<'_, Sqlite>,
    expected: &[MigrationAsset],
) -> MigrationResult<()> {
    if !migration_table_exists(transaction, ASSETS_V2_TABLE_NAME).await? {
        return Ok(());
    }

    let wallet_expression =
        if migration_column_exists(transaction, ASSETS_V2_TABLE_NAME, "wallet").await? {
            "COALESCE(wallet, '')"
        } else {
            "''"
        };
    let asset_type_expression =
        if migration_column_exists(transaction, ASSETS_V2_TABLE_NAME, "asset_type").await? {
            "asset_type"
        } else {
            "'crypto'"
        };
    let query = format!(
        "SELECT id, uuid, createdAt AS created_at,
                {wallet_expression} AS wallet,
                {asset_type_expression} AS asset_type,
                symbol, amount, value, price
         FROM assets_v2
         ORDER BY id"
    );
    let destination = sqlx::query_as::<_, ExistingDestinationAsset>(&query)
        .fetch_all(&mut **transaction)
        .await
        .map_err(|error| format!("failed to inspect partial v0.2 assets: {error}"))?;
    let mut matched_expected = vec![false; expected.len()];

    for row in destination {
        let expected_index = expected.iter().enumerate().position(|(index, expected)| {
            !matched_expected[index] && destination_matches_expected_conversion(&row, expected)
        });
        let Some(expected_index) = expected_index else {
            return Err(format!(
                "assets_v2 row {} (uuid={}, asset_type={}, wallet={}, symbol={}, createdAt={:?}, amount={}, value={}, price={}) is not a subset of the expected v0.1 conversion",
                row.id,
                row.uuid,
                row.asset_type,
                row.wallet,
                row.symbol,
                row.created_at,
                row.amount,
                row.value,
                row.price,
            ));
        };
        matched_expected[expected_index] = true;
    }
    Ok(())
}

async fn reject_v1_destination_dependencies(
    transaction: &mut SqliteTransaction<'_, Sqlite>,
) -> MigrationResult<()> {
    for table_name in ["asset_prices", TRANSACTION_TABLE_NAME] {
        if !migration_table_exists(transaction, table_name).await? {
            continue;
        }
        let query = format!(
            "SELECT dependent.id AS dependent_id, dependent.assetID
             FROM \"{table_name}\" AS dependent
             ORDER BY dependent.id
             LIMIT 1"
        );
        let dependency = sqlx::query(&query)
            .fetch_optional(&mut **transaction)
            .await
            .map_err(|error| {
                format!("failed to inspect {table_name} asset dependencies: {error}")
            })?;
        if let Some(dependency) = dependency {
            return Err(format!(
                "{table_name} row {} with assetID {} prevents compatible v0.1 destination rebuild",
                dependency.get::<i64, _>("dependent_id"),
                dependency.get::<i64, _>("assetID"),
            ));
        }
    }
    Ok(())
}

async fn insert_converted_v1_asset(
    transaction: &mut SqliteTransaction<'_, Sqlite>,
    asset: &MigrationAsset,
    with_wallet: bool,
    with_asset_type: bool,
) -> MigrationResult<()> {
    let mut columns = vec!["uuid", "symbol", "amount", "value", "price", "createdAt"];
    if with_wallet {
        columns.push("wallet");
    }
    if with_asset_type {
        columns.push("asset_type");
    }
    let placeholders = vec!["?"; columns.len()].join(", ");
    let query = format!(
        "INSERT INTO assets_v2 ({}) VALUES ({placeholders})",
        columns.join(", ")
    );
    let mut query = sqlx::query(&query)
        .bind(&asset.uuid)
        .bind(&asset.symbol)
        .bind(asset.amount)
        .bind(asset.value)
        .bind(asset.price)
        .bind(&asset.created_at);
    if with_wallet {
        query = query.bind("");
    }
    if with_asset_type {
        query = query.bind(&asset.asset_type);
    }
    query
        .execute(&mut **transaction)
        .await
        .map_err(|error| format!("failed to migrate v0.1 asset: {error}"))?;
    Ok(())
}

async fn migrate_v1_to_v2(
    connection: &mut SqliteConnection,
    resource_dir: &Path,
) -> MigrationResult<()> {
    let assets_v2 = read_migration_sql(resource_dir, "v01t02/assets_v2_up.sql")?;
    let cloud_sync = read_migration_sql(resource_dir, "v01t02/cloud_sync_up.sql")?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("failed to begin v0.1 to v0.2 migration: {error}"))?;

    let has_legacy_assets = migration_table_exists(&mut transaction, "assets").await?;
    if has_legacy_assets && migration_table_exists(&mut transaction, "assets_bak").await? {
        return Err(
            "cannot archive legacy assets because assets_bak already exists; both tables were left unchanged"
                .to_string(),
        );
    }

    let converted_assets = if has_legacy_assets {
        let null_timestamp_row: Option<i64> =
            sqlx::query_scalar("SELECT id FROM assets WHERE createdAt IS NULL ORDER BY id LIMIT 1")
                .fetch_optional(&mut *transaction)
                .await
                .map_err(|error| format!("failed to inspect v0.1 asset timestamps: {error}"))?;
        if let Some(row_id) = null_timestamp_row {
            return Err(format!(
                "legacy assets row {row_id} has NULL createdAt; migration was not started"
            ));
        }

        let assets = sqlx::query_as::<_, AssetsV1>("SELECT * FROM assets")
            .fetch_all(&mut *transaction)
            .await
            .map_err(|error| format!("failed to load v0.1 assets: {error}"))?;
        let converted_assets = move_data_from_assets_to_v2(assets);
        validate_v1_destination_subset(&mut transaction, &converted_assets).await?;
        reject_v1_destination_dependencies(&mut transaction).await?;
        Some(converted_assets)
    } else {
        None
    };

    sqlx::raw_sql(&assets_v2)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("failed to create v0.2 assets table: {error}"))?;
    sqlx::raw_sql(&cloud_sync)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("failed to create cloud sync table: {error}"))?;

    if let Some(converted_assets) = converted_assets {
        transaction
            .execute("DELETE FROM assets_v2")
            .await
            .map_err(|error| format!("failed to clear partial v0.2 assets: {error}"))?;
        let with_wallet =
            migration_column_exists(&mut transaction, ASSETS_V2_TABLE_NAME, "wallet").await?;
        let with_asset_type =
            migration_column_exists(&mut transaction, ASSETS_V2_TABLE_NAME, "asset_type").await?;
        for asset in converted_assets {
            insert_converted_v1_asset(&mut transaction, &asset, with_wallet, with_asset_type)
                .await?;
        }
        transaction
            .execute("CREATE TABLE assets_bak AS SELECT * FROM assets")
            .await
            .map_err(|error| format!("failed to archive v0.1 assets table: {error}"))?;
        transaction
            .execute("DROP TABLE assets")
            .await
            .map_err(|error| format!("failed to remove archived v0.1 assets table: {error}"))?;
    }

    write_migration_version(&mut transaction, "0.2.0").await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("failed to commit v0.1 to v0.2 migration: {error}"))
}

async fn migrate_v2_to_v3(connection: &mut SqliteConnection) -> MigrationResult<()> {
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("failed to begin v0.2 to v0.3 migration: {error}"))?;
    if !migration_column_exists(&mut transaction, ASSETS_V2_TABLE_NAME, "wallet").await? {
        transaction
            .execute("ALTER TABLE assets_v2 ADD COLUMN wallet TEXT")
            .await
            .map_err(|error| format!("failed to add assets_v2.wallet: {error}"))?;
    }
    write_migration_version(&mut transaction, "0.3.0").await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("failed to commit v0.2 to v0.3 migration: {error}"))
}

async fn migrate_v3_to_v4(
    connection: &mut SqliteConnection,
    resource_dir: &Path,
) -> MigrationResult<()> {
    let asset_prices = read_migration_sql(resource_dir, "v03t04/asset_prices_up.sql")?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("failed to begin v0.3 to v0.4 migration: {error}"))?;
    sqlx::raw_sql(&asset_prices)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("failed to create asset prices table: {error}"))?;
    write_migration_version(&mut transaction, "0.4.0").await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("failed to commit v0.3 to v0.4 migration: {error}"))
}

async fn insert_transaction_if_missing(
    transaction: &mut SqliteTransaction<'_, Sqlite>,
    row: GeneratedTransaction,
    with_asset_type: bool,
) -> MigrationResult<()> {
    if with_asset_type {
        sqlx::query(
            "INSERT INTO transactions (
                uuid, assetID, asset_type, wallet, symbol, amount, price,
                txnType, txnCreatedAt, createdAt
             )
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
             WHERE NOT EXISTS (
                 SELECT 1 FROM transactions
                 WHERE uuid = ?
                   AND assetID = ?
                   AND asset_type = ?
             )",
        )
        .bind(&row.uuid)
        .bind(row.asset_id)
        .bind(&row.asset_type)
        .bind(&row.wallet)
        .bind(&row.symbol)
        .bind(row.amount)
        .bind(row.price)
        .bind(&row.txn_type)
        .bind(&row.txn_created_at)
        .bind(&row.created_at)
        .bind(&row.uuid)
        .bind(row.asset_id)
        .bind(&row.asset_type)
        .execute(&mut **transaction)
        .await
        .map_err(|error| format!("failed to backfill transaction: {error}"))?;
    } else {
        sqlx::query(
            "INSERT INTO transactions (
                uuid, assetID, wallet, symbol, amount, price,
                txnType, txnCreatedAt, createdAt
             )
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
             WHERE NOT EXISTS (
                 SELECT 1 FROM transactions
                 WHERE uuid = ?
                   AND assetID = ?
             )",
        )
        .bind(&row.uuid)
        .bind(row.asset_id)
        .bind(&row.wallet)
        .bind(&row.symbol)
        .bind(row.amount)
        .bind(row.price)
        .bind(&row.txn_type)
        .bind(&row.txn_created_at)
        .bind(&row.created_at)
        .bind(&row.uuid)
        .bind(row.asset_id)
        .execute(&mut **transaction)
        .await
        .map_err(|error| format!("failed to backfill transaction: {error}"))?;
    }
    Ok(())
}

async fn load_assets_for_transaction_backfill(
    transaction: &mut SqliteTransaction<'_, Sqlite>,
) -> MigrationResult<Vec<MigrationAsset>> {
    let query = if migration_column_exists(transaction, ASSETS_V2_TABLE_NAME, "asset_type").await? {
        "SELECT id, uuid, createdAt AS created_at, symbol, amount, value, price,
                wallet, asset_type
         FROM assets_v2
         ORDER BY createdAt ASC, id ASC"
    } else {
        "SELECT id, uuid, createdAt AS created_at, symbol, amount, value, price,
                wallet, 'crypto' AS asset_type
         FROM assets_v2
         ORDER BY createdAt ASC, id ASC"
    };
    sqlx::query_as::<_, MigrationAsset>(query)
        .fetch_all(&mut **transaction)
        .await
        .map_err(|error| format!("failed to load assets for transaction backfill: {error}"))
}

async fn load_prices_for_transaction_backfill(
    transaction: &mut SqliteTransaction<'_, Sqlite>,
) -> MigrationResult<Vec<MigrationAssetPrice>> {
    sqlx::query_as::<_, MigrationAssetPrice>(
        "SELECT assetID AS asset_id, price
         FROM asset_prices",
    )
    .fetch_all(&mut **transaction)
    .await
    .map_err(|error| format!("failed to load prices for transaction backfill: {error}"))
}

async fn migrate_v4_to_v5(
    connection: &mut SqliteConnection,
    resource_dir: &Path,
) -> MigrationResult<()> {
    let cloud_sync_down = read_migration_sql(resource_dir, "v04t05/cloud_sync_down.sql")?;
    let transactions_up = read_migration_sql(resource_dir, "v04t05/transactions_up.sql")?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("failed to begin v0.4 to v0.5 migration: {error}"))?;

    sqlx::raw_sql(&cloud_sync_down)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("failed to remove cloud sync table: {error}"))?;
    normalize_wallets_and_repair_assets_indexes(&mut transaction).await?;
    sqlx::raw_sql(&transactions_up)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("failed to create transactions table: {error}"))?;
    let assets_have_asset_type =
        migration_column_exists(&mut transaction, ASSETS_V2_TABLE_NAME, "asset_type").await?;
    if assets_have_asset_type
        && !migration_column_exists(&mut transaction, TRANSACTION_TABLE_NAME, "asset_type").await?
    {
        transaction
            .execute(
                "ALTER TABLE transactions
                 ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'crypto'",
            )
            .await
            .map_err(|error| {
                format!("failed to prepare transactions.asset_type for backfill: {error}")
            })?;
    }

    let assets = load_assets_for_transaction_backfill(&mut transaction).await?;
    let asset_prices = load_prices_for_transaction_backfill(&mut transaction).await?;
    let transactions_have_asset_type =
        migration_column_exists(&mut transaction, TRANSACTION_TABLE_NAME, "asset_type").await?;
    for row in move_data_from_assets_and_assets_price_to_transactions(assets, asset_prices) {
        insert_transaction_if_missing(&mut transaction, row, transactions_have_asset_type).await?;
    }

    write_migration_version(&mut transaction, "0.5.0").await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("failed to commit v0.4 to v0.5 migration: {error}"))
}

async fn migrate_v6_to_v7(
    connection: &mut SqliteConnection,
    resource_dir: &Path,
) -> MigrationResult<()> {
    let transactions_up = read_migration_sql(resource_dir, "v04t05/transactions_up.sql")?;
    let transactions_asset_type =
        read_migration_sql(resource_dir, "v06t07/transactions_asset_type_up.sql")?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("failed to begin v0.6 to v0.7 migration: {error}"))?;

    if !migration_column_exists(&mut transaction, ASSETS_V2_TABLE_NAME, "asset_type").await? {
        transaction
            .execute(
                "ALTER TABLE assets_v2
                 ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'crypto'",
            )
            .await
            .map_err(|error| format!("failed to add assets_v2.asset_type: {error}"))?;
    }
    normalize_wallets_and_repair_assets_indexes(&mut transaction).await?;

    sqlx::raw_sql(&transactions_up)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("failed to ensure transactions table: {error}"))?;
    if !migration_column_exists(&mut transaction, TRANSACTION_TABLE_NAME, "asset_type").await? {
        sqlx::raw_sql(&transactions_asset_type)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("failed to add transactions.asset_type: {error}"))?;
    }

    write_migration_version(&mut transaction, "0.7.0").await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("failed to commit v0.6 to v0.7 migration: {error}"))
}

async fn migrate_v7_to_v8(
    connection: &mut SqliteConnection,
    resource_dir: &Path,
) -> MigrationResult<()> {
    let chat_sessions = read_migration_sql(resource_dir, "v07t08/chat_sessions_up.sql")?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("failed to begin v0.7 to v0.8 migration: {error}"))?;
    sqlx::raw_sql(&chat_sessions)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("failed to create chat sessions table: {error}"))?;
    write_migration_version(&mut transaction, "0.8.0").await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("failed to commit v0.7 to v0.8 migration: {error}"))
}

async fn repair_required_schema(
    connection: &mut SqliteConnection,
    resource_dir: &Path,
    app_version: &str,
) -> MigrationResult<()> {
    let assets_v2 = read_migration_sql(resource_dir, "init/assets_v2_up.sql")?;
    let asset_prices = read_migration_sql(resource_dir, "init/asset_prices_up.sql")?;
    let transactions = read_migration_sql(resource_dir, "init/transactions_up.sql")?;
    let chat_sessions = read_migration_sql(resource_dir, "init/chat_sessions_up.sql")?;
    let currency_rates = read_migration_sql(resource_dir, "init/currency_rates_up.sql")?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("failed to begin schema repair transaction: {error}"))?;

    if !migration_table_exists(&mut transaction, ASSETS_V2_TABLE_NAME).await? {
        sqlx::raw_sql(&assets_v2)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("failed to create required assets_v2 table: {error}"))?;
    }
    if !migration_column_exists(&mut transaction, ASSETS_V2_TABLE_NAME, "wallet").await? {
        transaction
            .execute("ALTER TABLE assets_v2 ADD COLUMN wallet TEXT")
            .await
            .map_err(|error| format!("failed to repair assets_v2.wallet: {error}"))?;
    }
    if !migration_column_exists(&mut transaction, ASSETS_V2_TABLE_NAME, "asset_type").await? {
        transaction
            .execute(
                "ALTER TABLE assets_v2
                 ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'crypto'",
            )
            .await
            .map_err(|error| format!("failed to repair assets_v2.asset_type: {error}"))?;
    }
    normalize_wallets_and_repair_assets_indexes(&mut transaction).await?;

    sqlx::raw_sql(&asset_prices)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("failed to ensure required asset_prices table: {error}"))?;
    repair_index(
        &mut transaction,
        "asset_prices",
        "unique_uuid_asset_id",
        true,
        &[("uuid", false), ("assetID", false)],
    )
    .await?;

    sqlx::raw_sql(&transactions)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("failed to ensure required transactions table: {error}"))?;
    if !migration_column_exists(&mut transaction, TRANSACTION_TABLE_NAME, "asset_type").await? {
        transaction
            .execute(
                "ALTER TABLE transactions
                 ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'crypto'",
            )
            .await
            .map_err(|error| format!("failed to repair transactions.asset_type: {error}"))?;
    }
    repair_index(
        &mut transaction,
        TRANSACTION_TABLE_NAME,
        "txn_symbol_idx",
        false,
        &[("symbol", false)],
    )
    .await?;
    repair_index(
        &mut transaction,
        TRANSACTION_TABLE_NAME,
        "txn_txnCreatedAt_idx",
        false,
        &[("txnCreatedAt", false)],
    )
    .await?;
    repair_index(
        &mut transaction,
        TRANSACTION_TABLE_NAME,
        "txn_wallet_symbol_idx",
        false,
        &[("wallet", false), ("symbol", false)],
    )
    .await?;

    sqlx::raw_sql(&chat_sessions)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("failed to ensure required chat_sessions table: {error}"))?;
    repair_index(
        &mut transaction,
        "chat_sessions",
        "chat_sessions_pinned_updated_idx",
        false,
        &[("pinned", true), ("updatedAt", true)],
    )
    .await?;

    sqlx::raw_sql(&currency_rates)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("failed to ensure required currency_rates table: {error}"))?;
    repair_index(
        &mut transaction,
        "currency_rates",
        "unique_currency",
        true,
        &[("currency", false)],
    )
    .await?;

    write_migration_version(&mut transaction, app_version).await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("failed to commit schema repair transaction: {error}"))
}

async fn record_client_id(connection: &mut SqliteConnection) -> MigrationResult<()> {
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("failed to begin client ID transaction: {error}"))?;
    sqlx::query("INSERT OR IGNORE INTO configuration (id, data) VALUES (?, ?)")
        .bind(CLIENT_ID_CONFIGURATION_ID)
        .bind(Uuid::new_v4().to_string())
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("failed to record client ID: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("failed to commit client ID: {error}"))
}

pub async fn run_migrations(
    database_path: &Path,
    resource_dir: &Path,
    app_version: &str,
) -> MigrationResult<()> {
    let options = SqliteConnectOptions::new()
        .filename(database_path)
        .create_if_missing(false);
    let mut connection = SqliteConnection::connect_with(&options)
        .await
        .map_err(|error| {
            format!(
                "failed to open database {} for migration: {error}",
                database_path.display()
            )
        })?;
    let recorded_version = load_recorded_database_version(&mut connection).await?;
    if let Some(recorded_version) = &recorded_version {
        if version_is_greater(recorded_version, app_version)? {
            connection.close().await.map_err(|error| {
                format!(
                    "failed to close database {} after version check: {error}",
                    database_path.display()
                )
            })?;
            return Err(format!(
                "database version {recorded_version} is newer than app version {app_version}"
            ));
        }
    }
    let mut previous_version = match recorded_version {
        Some(version) => version,
        None => infer_database_version(&mut connection).await?,
    };

    if version_is_less(&previous_version, "0.2.0")? {
        migrate_v1_to_v2(&mut connection, resource_dir).await?;
        previous_version = load_database_version(&mut connection).await?;
    }
    if version_is_less(&previous_version, "0.3.0")? {
        migrate_v2_to_v3(&mut connection).await?;
        previous_version = load_database_version(&mut connection).await?;
    }
    if version_is_less(&previous_version, "0.4.0")? {
        migrate_v3_to_v4(&mut connection, resource_dir).await?;
        previous_version = load_database_version(&mut connection).await?;
    }
    if version_is_less(&previous_version, "0.5.0")? {
        migrate_v4_to_v5(&mut connection, resource_dir).await?;
        previous_version = load_database_version(&mut connection).await?;
    }
    if version_is_less(&previous_version, "0.7.0")? {
        migrate_v6_to_v7(&mut connection, resource_dir).await?;
        previous_version = load_database_version(&mut connection).await?;
    }
    if version_is_less(&previous_version, "0.8.0")? {
        migrate_v7_to_v8(&mut connection, resource_dir).await?;
    }

    repair_required_schema(&mut connection, resource_dir, app_version).await?;
    record_client_id(&mut connection).await?;
    connection.close().await.map_err(|error| {
        format!(
            "failed to close migrated database {}: {error}",
            database_path.display()
        )
    })
}

#[cfg(test)]
mod tests {
    use super::run_migrations;
    use sqlx::{sqlite::SqliteConnectOptions, Connection, Executor, Row, SqliteConnection};
    use std::{
        fs,
        path::{Path, PathBuf},
    };
    use tokio::runtime::Runtime;
    use uuid::Uuid;

    const LEGACY_CONFIGURATION_PAYLOAD: &str =
        "currency: USD\ncurrencies:\n  - USD\n  - HKD\nquoteColor: green\n";
    const FIRST_LEGACY_TIMESTAMP: &str = "2024-01-01 01:02:03";
    const SECOND_LEGACY_TIMESTAMP: &str = "2024-01-02 04:05:06";

    fn make_temp_dir(prefix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("track3-{prefix}-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn resource_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    }

    #[derive(Clone, Copy, Debug)]
    enum LegacyVersion {
        V01,
        V02,
        V03,
        V04,
        V05,
        V06,
        V07,
    }

    impl LegacyVersion {
        fn version(self) -> &'static str {
            match self {
                Self::V01 => "0.1.0",
                Self::V02 => "0.2.0",
                Self::V03 => "0.3.0",
                Self::V04 => "0.4.0",
                Self::V05 => "0.5.0",
                Self::V06 => "0.6.0",
                Self::V07 => "0.7.0",
            }
        }

        fn expected_asset_count(self) -> i64 {
            if matches!(self, Self::V01) {
                4
            } else {
                1
            }
        }

        fn expected_transaction_count(self) -> i64 {
            match self {
                Self::V01 => 5,
                Self::V02 | Self::V03 | Self::V04 => 1,
                Self::V05 | Self::V06 | Self::V07 => 0,
            }
        }
    }

    async fn connect(path: &Path) -> SqliteConnection {
        SqliteConnection::connect_with(
            &SqliteConnectOptions::new()
                .filename(path)
                .create_if_missing(true),
        )
        .await
        .unwrap()
    }

    async fn create_configuration(conn: &mut SqliteConnection, version: LegacyVersion) {
        conn.execute(
            "CREATE TABLE configuration (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
                data TEXT NOT NULL
            )",
        )
        .await
        .unwrap();
        sqlx::query("INSERT INTO configuration (id, data) VALUES (10, ?)")
            .bind(LEGACY_CONFIGURATION_PAYLOAD)
            .execute(&mut *conn)
            .await
            .unwrap();
        if !matches!(version, LegacyVersion::V01 | LegacyVersion::V02) {
            sqlx::query("INSERT INTO configuration (id, data) VALUES (999, ?)")
                .bind(version.version())
                .execute(&mut *conn)
                .await
                .unwrap();
        }
    }

    async fn create_v1_assets(conn: &mut SqliteConnection) {
        conn.execute(
            "CREATE TABLE assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                createdAt DATETIME,
                top01 TEXT, amount01 REAL, value01 REAL,
                top02 TEXT, amount02 REAL, value02 REAL,
                top03 TEXT, amount03 REAL, value03 REAL,
                top04 TEXT, amount04 REAL, value04 REAL,
                top05 TEXT, amount05 REAL, value05 REAL,
                top06 TEXT, amount06 REAL, value06 REAL,
                top07 TEXT, amount07 REAL, value07 REAL,
                top08 TEXT, amount08 REAL, value08 REAL,
                top09 TEXT, amount09 REAL, value09 REAL,
                top10 TEXT, amount10 REAL, value10 REAL,
                topOthers TEXT, amountOthers TEXT, valueOthers REAL, total REAL
            )",
        )
        .await
        .unwrap();
        conn.execute(
            "INSERT INTO assets (
                createdAt,
                top01, amount01, value01,
                top02, amount02, value02,
                topOthers, amountOthers, valueOthers,
                total
             ) VALUES (
                '2024-01-01 01:02:03',
                'BTC', 2.0, 100.0,
                'USDT', 10.0, 10.0,
                'other', '5.0', 5.0,
                115.0
             ), (
                '2024-01-02 04:05:06',
                'BTC', 1.5, 90.0,
                'ETH', 3.0, 75.0,
                NULL, NULL, NULL,
                165.0
             )",
        )
        .await
        .unwrap();
    }

    async fn create_partial_v1_destination(conn: &mut SqliteConnection) {
        conn.execute(
            "CREATE TABLE assets_v2 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                symbol TEXT NOT NULL,
                amount REAL NOT NULL,
                value REAL NOT NULL,
                price REAL NOT NULL
            );
            INSERT INTO assets_v2 (
                uuid, createdAt, symbol, amount, value, price
            ) VALUES (
                'interrupted-batch', '2024-01-01 01:02:03',
                'BTC', 2.0, 100.0, 50.0
            );",
        )
        .await
        .unwrap();
    }

    async fn create_conflicting_modern_v1_destination(conn: &mut SqliteConnection) {
        conn.execute(
            "CREATE TABLE assets_v2 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                wallet TEXT,
                asset_type TEXT NOT NULL DEFAULT 'crypto',
                symbol TEXT NOT NULL,
                amount REAL NOT NULL,
                value REAL NOT NULL,
                price REAL NOT NULL
            );
            CREATE UNIQUE INDEX unique_uuid_asset_type_symbol_wallet
                ON assets_v2 (uuid, asset_type, symbol, wallet);
            INSERT INTO assets_v2 (
                uuid, createdAt, wallet, asset_type, symbol, amount, value, price
            ) VALUES (
                'modern-batch', '2025-05-05 05:05:05', 'broker-a', 'stock',
                'AAPL', 4.0, 800.0, 200.0
            );",
        )
        .await
        .unwrap();
    }

    async fn create_compatible_modern_v1_destination(conn: &mut SqliteConnection) {
        conn.execute(
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
            INSERT INTO assets_v2 (
                uuid, createdAt, wallet, asset_type, symbol, amount, value, price
            ) VALUES (
                'interrupted-modern-batch', '2024-01-01 01:02:03', '', 'crypto',
                'BTC', 2.0, 100.0, 50.0
            );",
        )
        .await
        .unwrap();
    }

    async fn create_assets_v2(conn: &mut SqliteConnection, version: LegacyVersion) {
        let sql = match version {
            LegacyVersion::V02 => {
                "CREATE TABLE assets_v2 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uuid TEXT NOT NULL,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    symbol TEXT NOT NULL,
                    amount REAL NOT NULL,
                    value REAL NOT NULL,
                    price REAL NOT NULL
                )"
            }
            LegacyVersion::V03 | LegacyVersion::V04 | LegacyVersion::V05 | LegacyVersion::V06 => {
                "CREATE TABLE assets_v2 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uuid TEXT NOT NULL,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    symbol TEXT NOT NULL,
                    amount REAL NOT NULL,
                    value REAL NOT NULL,
                    price REAL NOT NULL,
                    wallet TEXT
                )"
            }
            LegacyVersion::V07 => {
                "CREATE TABLE assets_v2 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uuid TEXT NOT NULL,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    symbol TEXT NOT NULL,
                    amount REAL NOT NULL,
                    value REAL NOT NULL,
                    price REAL NOT NULL,
                    wallet TEXT,
                    asset_type TEXT NOT NULL DEFAULT 'crypto'
                )"
            }
            LegacyVersion::V01 => unreachable!(),
        };
        conn.execute(sql).await.unwrap();

        match version {
            LegacyVersion::V02 => {
                conn.execute(
                    "INSERT INTO assets_v2 (
                        uuid, createdAt, symbol, amount, value, price
                     ) VALUES (
                        'fixture-batch', '2024-01-01 00:00:00',
                        'BTC', 2.0, 100.0, 50.0
                     )",
                )
                .await
                .unwrap();
            }
            _ => {
                conn.execute(
                    "INSERT INTO assets_v2 (
                        uuid, createdAt, symbol, amount, value, price, wallet
                     ) VALUES (
                        'fixture-batch', '2024-01-01 00:00:00',
                        'BTC', 2.0, 100.0, 50.0, 'wallet-a'
                     )",
                )
                .await
                .unwrap();
            }
        }
    }

    async fn create_asset_prices(conn: &mut SqliteConnection) {
        conn.execute(
            "CREATE TABLE asset_prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT NOT NULL,
                assetID INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                price REAL NOT NULL,
                assetCreatedAt DATETIME NOT NULL,
                updatedAt DATETIME NOT NULL
            );
            CREATE UNIQUE INDEX unique_uuid_asset_id
                ON asset_prices (uuid, assetID);
            INSERT INTO asset_prices (
                uuid, assetID, symbol, price, assetCreatedAt, updatedAt
            ) VALUES (
                'fixture-price', 1, 'BTC', 55.0,
                '2024-01-01 00:00:00', '2024-01-01 00:00:00'
            )",
        )
        .await
        .unwrap();
    }

    async fn create_legacy_transactions(conn: &mut SqliteConnection, with_asset_type: bool) {
        let asset_type = if with_asset_type {
            "asset_type TEXT NOT NULL DEFAULT 'crypto',"
        } else {
            ""
        };
        conn.execute(
            format!(
                "CREATE TABLE transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uuid TEXT NOT NULL,
                    assetID INTEGER NOT NULL,
                    {asset_type}
                    wallet TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    amount REAL NOT NULL,
                    price REAL NOT NULL,
                    txnType TEXT NOT NULL,
                    txnCreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX txn_symbol_idx ON transactions (symbol);
                CREATE INDEX txn_txnCreatedAt_idx ON transactions (txnCreatedAt);
                CREATE INDEX txn_wallet_symbol_idx ON transactions (wallet, symbol);"
            )
            .as_str(),
        )
        .await
        .unwrap();
    }

    async fn create_legacy_fixture(path: &Path, version: LegacyVersion) {
        let mut conn = connect(path).await;
        create_configuration(&mut conn, version).await;

        if matches!(version, LegacyVersion::V01) {
            create_v1_assets(&mut conn).await;
        } else {
            create_assets_v2(&mut conn, version).await;
        }

        if matches!(
            version,
            LegacyVersion::V01 | LegacyVersion::V02 | LegacyVersion::V03 | LegacyVersion::V04
        ) {
            conn.execute(
                "CREATE TABLE cloud_sync (
                    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
                    publicKey TEXT NOT NULL,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO cloud_sync (publicKey) VALUES ('fixture-key');",
            )
            .await
            .unwrap();
        }

        if matches!(
            version,
            LegacyVersion::V04 | LegacyVersion::V06 | LegacyVersion::V07 | LegacyVersion::V05
        ) {
            create_asset_prices(&mut conn).await;
        }

        if matches!(
            version,
            LegacyVersion::V05 | LegacyVersion::V06 | LegacyVersion::V07
        ) {
            create_legacy_transactions(&mut conn, matches!(version, LegacyVersion::V07)).await;
            if matches!(version, LegacyVersion::V05 | LegacyVersion::V06) {
                conn.execute(
                    "CREATE UNIQUE INDEX unique_uuid_symbol_amount_wallet
                     ON assets_v2 (uuid, symbol, wallet)",
                )
                .await
                .unwrap();
            } else {
                conn.execute(
                    "CREATE UNIQUE INDEX unique_uuid_asset_type_symbol_wallet
                     ON assets_v2 (uuid, asset_type, symbol, wallet)",
                )
                .await
                .unwrap();
            }
        }

        conn.close().await.unwrap();
    }

    async fn table_exists(conn: &mut SqliteConnection, table: &str) -> bool {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type = 'table' AND name = ?",
        )
        .bind(table)
        .fetch_one(&mut *conn)
        .await
        .unwrap()
            > 0
    }

    async fn column_exists(conn: &mut SqliteConnection, table: &str, column: &str) -> bool {
        let sql = format!("SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = ?");
        sqlx::query_scalar::<_, i64>(&sql)
            .bind(column)
            .fetch_one(&mut *conn)
            .await
            .unwrap()
            > 0
    }

    async fn index_exists(conn: &mut SqliteConnection, index: &str) -> bool {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type = 'index' AND name = ?",
        )
        .bind(index)
        .fetch_one(&mut *conn)
        .await
        .unwrap()
            > 0
    }

    async fn configuration(conn: &mut SqliteConnection, id: i32) -> Option<String> {
        sqlx::query_scalar("SELECT data FROM configuration WHERE id = ?")
            .bind(id)
            .fetch_optional(&mut *conn)
            .await
            .unwrap()
    }

    async fn assert_current_schema_and_data(
        path: &Path,
        expected_asset_count: i64,
        expected_transaction_count: i64,
    ) -> String {
        let mut conn = connect(path).await;
        assert_eq!(
            configuration(&mut conn, 999).await.as_deref(),
            Some("0.8.1")
        );
        assert_eq!(
            configuration(&mut conn, 10).await.as_deref(),
            Some(LEGACY_CONFIGURATION_PAYLOAD)
        );
        let client_id = configuration(&mut conn, 998)
            .await
            .expect("client ID should be created after migrations");
        assert!(Uuid::parse_str(&client_id).is_ok());

        assert!(table_exists(&mut conn, "asset_prices").await);
        assert!(table_exists(&mut conn, "transactions").await);
        assert!(table_exists(&mut conn, "chat_sessions").await);
        assert!(column_exists(&mut conn, "assets_v2", "wallet").await);
        assert!(column_exists(&mut conn, "assets_v2", "asset_type").await);
        assert!(column_exists(&mut conn, "transactions", "asset_type").await);

        let asset_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets_v2")
            .fetch_one(&mut conn)
            .await
            .unwrap();
        let transaction_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM transactions")
            .fetch_one(&mut conn)
            .await
            .unwrap();
        assert_eq!(asset_count, expected_asset_count);
        assert_eq!(transaction_count, expected_transaction_count);
        conn.close().await.unwrap();
        client_id
    }

    async fn assert_complete_legacy_chain_values(path: &Path) {
        let mut conn = connect(path).await;
        let assets = sqlx::query(
            "SELECT id, uuid, symbol, amount, value, price, createdAt, wallet, asset_type
             FROM assets_v2
             ORDER BY id",
        )
        .fetch_all(&mut conn)
        .await
        .unwrap();
        assert_eq!(assets.len(), 4);

        let expected_assets = [
            (1_i64, "BTC", 2.0, 100.0, 50.0, FIRST_LEGACY_TIMESTAMP),
            (2, "USDT", 15.0, 15.0, 1.0, FIRST_LEGACY_TIMESTAMP),
            (3, "BTC", 1.5, 90.0, 60.0, SECOND_LEGACY_TIMESTAMP),
            (4, "ETH", 3.0, 75.0, 25.0, SECOND_LEGACY_TIMESTAMP),
        ];
        for (row, expected) in assets.iter().zip(expected_assets) {
            assert_eq!(row.get::<i64, _>("id"), expected.0);
            assert_eq!(row.get::<String, _>("symbol"), expected.1);
            assert_eq!(row.get::<f64, _>("amount"), expected.2);
            assert_eq!(row.get::<f64, _>("value"), expected.3);
            assert_eq!(row.get::<f64, _>("price"), expected.4);
            assert_eq!(row.get::<String, _>("createdAt"), expected.5);
            assert_eq!(row.get::<String, _>("wallet"), "");
            assert_eq!(row.get::<String, _>("asset_type"), "crypto");
        }

        let first_batch = assets[0].get::<String, _>("uuid");
        let second_batch = assets[2].get::<String, _>("uuid");
        assert!(Uuid::parse_str(&first_batch).is_ok());
        assert!(Uuid::parse_str(&second_batch).is_ok());
        assert_eq!(assets[1].get::<String, _>("uuid"), first_batch);
        assert_eq!(assets[3].get::<String, _>("uuid"), second_batch);
        assert_ne!(first_batch, second_batch);

        let transactions = sqlx::query(
            "SELECT uuid, assetID, asset_type, wallet, symbol, amount, price,
                    txnType, txnCreatedAt, createdAt
             FROM transactions
             ORDER BY id",
        )
        .fetch_all(&mut conn)
        .await
        .unwrap();
        assert_eq!(transactions.len(), 5);
        let expected_transactions = [
            (
                &first_batch,
                1_i64,
                "BTC",
                2.0,
                50.0,
                "buy",
                FIRST_LEGACY_TIMESTAMP,
            ),
            (
                &first_batch,
                2,
                "USDT",
                15.0,
                1.0,
                "buy",
                FIRST_LEGACY_TIMESTAMP,
            ),
            (
                &second_batch,
                3,
                "BTC",
                0.5,
                60.0,
                "sell",
                SECOND_LEGACY_TIMESTAMP,
            ),
            (
                &second_batch,
                4,
                "ETH",
                3.0,
                25.0,
                "buy",
                SECOND_LEGACY_TIMESTAMP,
            ),
            (
                &second_batch,
                2,
                "USDT",
                15.0,
                1.0,
                "sell",
                FIRST_LEGACY_TIMESTAMP,
            ),
        ];
        for (row, expected) in transactions.iter().zip(expected_transactions) {
            assert_eq!(row.get::<String, _>("uuid"), *expected.0);
            assert_eq!(row.get::<i64, _>("assetID"), expected.1);
            assert_eq!(row.get::<String, _>("symbol"), expected.2);
            assert_eq!(row.get::<f64, _>("amount"), expected.3);
            assert_eq!(row.get::<f64, _>("price"), expected.4);
            assert_eq!(row.get::<String, _>("txnType"), expected.5);
            assert_eq!(row.get::<String, _>("txnCreatedAt"), expected.6);
            assert_eq!(row.get::<String, _>("createdAt"), expected.6);
            assert_eq!(row.get::<String, _>("wallet"), "");
            assert_eq!(row.get::<String, _>("asset_type"), "crypto");
        }

        let archived_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets_bak")
            .fetch_one(&mut conn)
            .await
            .unwrap();
        assert_eq!(archived_count, 2);
        conn.close().await.unwrap();
    }

    async fn assert_complete_legacy_asset_business_rows(path: &Path) {
        let mut conn = connect(path).await;
        let rows = sqlx::query(
            "SELECT symbol, amount, value, price, createdAt
             FROM assets_v2
             ORDER BY createdAt, symbol",
        )
        .fetch_all(&mut conn)
        .await
        .unwrap();
        let expected = [
            ("BTC", 2.0, 100.0, 50.0, FIRST_LEGACY_TIMESTAMP),
            ("USDT", 15.0, 15.0, 1.0, FIRST_LEGACY_TIMESTAMP),
            ("BTC", 1.5, 90.0, 60.0, SECOND_LEGACY_TIMESTAMP),
            ("ETH", 3.0, 75.0, 25.0, SECOND_LEGACY_TIMESTAMP),
        ];
        assert_eq!(rows.len(), expected.len());
        for (row, expected) in rows.iter().zip(expected) {
            assert_eq!(row.get::<String, _>("symbol"), expected.0);
            assert_eq!(row.get::<f64, _>("amount"), expected.1);
            assert_eq!(row.get::<f64, _>("value"), expected.2);
            assert_eq!(row.get::<f64, _>("price"), expected.3);
            assert_eq!(row.get::<String, _>("createdAt"), expected.4);
        }
        conn.close().await.unwrap();
    }

    #[test]
    fn complete_legacy_chain_preserves_assets_and_configuration() {
        let root = make_temp_dir("complete-chain");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V01).await;
            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();
            assert_current_schema_and_data(&database_path, 4, 5).await;
            assert_complete_legacy_chain_values(&database_path).await;
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn every_supported_legacy_state_recovers_twice_without_duplicates() {
        let rt = Runtime::new().unwrap();

        for version in [
            LegacyVersion::V01,
            LegacyVersion::V02,
            LegacyVersion::V03,
            LegacyVersion::V04,
            LegacyVersion::V05,
            LegacyVersion::V06,
            LegacyVersion::V07,
        ] {
            let root = make_temp_dir(&format!("reentrant-{}", version.version()));
            let database_path = root.join("legacy.db");
            rt.block_on(async {
                create_legacy_fixture(&database_path, version).await;
                run_migrations(&database_path, &resource_dir(), "0.8.1")
                    .await
                    .unwrap();
                let client_id = assert_current_schema_and_data(
                    &database_path,
                    version.expected_asset_count(),
                    version.expected_transaction_count(),
                )
                .await;

                let mut conn = connect(&database_path).await;
                sqlx::query(
                    "INSERT INTO configuration (id, data) VALUES (999, ?)
                     ON CONFLICT(id) DO UPDATE SET data = excluded.data",
                )
                .bind(version.version())
                .execute(&mut conn)
                .await
                .unwrap();
                conn.close().await.unwrap();

                run_migrations(&database_path, &resource_dir(), "0.8.1")
                    .await
                    .unwrap();
                let second_client_id = assert_current_schema_and_data(
                    &database_path,
                    version.expected_asset_count(),
                    version.expected_transaction_count(),
                )
                .await;
                assert_eq!(client_id, second_client_id);
            });
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn v2t3_recovers_when_wallet_column_already_exists() {
        let root = make_temp_dir("wallet-exists");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V02).await;
            let mut conn = connect(&database_path).await;
            conn.execute("ALTER TABLE assets_v2 ADD COLUMN wallet TEXT")
                .await
                .unwrap();
            conn.close().await.unwrap();

            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();
            assert_current_schema_and_data(&database_path, 1, 1).await;
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn v4t5_does_not_duplicate_a_committed_backfill_when_version_is_stale() {
        let root = make_temp_dir("committed-backfill");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V04).await;
            let mut conn = connect(&database_path).await;
            create_legacy_transactions(&mut conn, false).await;
            conn.execute(
                "INSERT INTO transactions (
                    uuid, assetID, wallet, symbol, amount, price,
                    txnType, txnCreatedAt, createdAt
                 ) VALUES (
                    'fixture-batch', 1, 'wallet-a', 'BTC', 2.0, 55.0,
                    'buy', '2024-01-01 00:00:00', '2024-01-01 00:00:00'
                 )",
            )
            .await
            .unwrap();
            conn.close().await.unwrap();

            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();
            assert_current_schema_and_data(&database_path, 1, 1).await;
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn v4t5_replay_preserves_an_edited_generated_transaction() {
        let root = make_temp_dir("edited-transaction");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V04).await;
            let mut conn = connect(&database_path).await;
            create_legacy_transactions(&mut conn, false).await;
            conn.execute(
                "INSERT INTO transactions (
                    uuid, assetID, wallet, symbol, amount, price,
                    txnType, txnCreatedAt, createdAt
                 ) VALUES (
                    'fixture-batch', 1, 'wallet-a', 'BTC', 2.0, 777.0,
                    'deposit', '2024-02-02 02:02:02', '2024-03-03 03:03:03'
                 )",
            )
            .await
            .unwrap();
            conn.close().await.unwrap();

            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            let mut conn = connect(&database_path).await;
            let transactions = sqlx::query(
                "SELECT asset_type, price, txnType, txnCreatedAt, createdAt
                 FROM transactions
                 WHERE uuid = 'fixture-batch' AND assetID = 1",
            )
            .fetch_all(&mut conn)
            .await
            .unwrap();
            assert_eq!(transactions.len(), 1);
            assert_eq!(transactions[0].get::<String, _>("asset_type"), "crypto");
            assert_eq!(transactions[0].get::<f64, _>("price"), 777.0);
            assert_eq!(transactions[0].get::<String, _>("txnType"), "deposit");
            assert_eq!(
                transactions[0].get::<String, _>("txnCreatedAt"),
                "2024-02-02 02:02:02"
            );
            assert_eq!(
                transactions[0].get::<String, _>("createdAt"),
                "2024-03-03 03:03:03"
            );
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn stale_marker_replay_preserves_stock_asset_type() {
        let root = make_temp_dir("stock-replay");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V07).await;
            let mut conn = connect(&database_path).await;
            conn.execute("UPDATE assets_v2 SET asset_type = 'stock' WHERE id = 1")
                .await
                .unwrap();
            conn.execute(
                "ALTER TABLE transactions DROP COLUMN asset_type;
                 UPDATE configuration SET data = '0.4.0' WHERE id = 999",
            )
            .await
            .unwrap();
            conn.close().await.unwrap();

            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            let mut conn = connect(&database_path).await;
            let asset_type: String = sqlx::query_scalar(
                "SELECT asset_type FROM transactions
                 WHERE uuid = 'fixture-batch' AND assetID = 1",
            )
            .fetch_one(&mut conn)
            .await
            .unwrap();
            assert_eq!(asset_type, "stock");
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn v1t2_rebuilds_a_partial_destination_without_losing_legacy_assets() {
        let root = make_temp_dir("partial-v2");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V01).await;
            let mut conn = connect(&database_path).await;
            create_partial_v1_destination(&mut conn).await;
            conn.close().await.unwrap();

            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            assert_current_schema_and_data(&database_path, 4, 5).await;
            assert_complete_legacy_asset_business_rows(&database_path).await;
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn v1t2_rejects_non_subset_modern_destination_without_mutation() {
        let root = make_temp_dir("mixed-v1-modern");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V01).await;
            let mut conn = connect(&database_path).await;
            create_conflicting_modern_v1_destination(&mut conn).await;
            conn.close().await.unwrap();

            let before = fs::read(&database_path).unwrap();
            let error = run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap_err();
            assert!(error.contains("assets_v2 row 1"), "{error}");
            assert!(error.contains("not a subset"), "{error}");
            assert_eq!(fs::read(&database_path).unwrap(), before);

            let mut conn = connect(&database_path).await;
            let modern_row = sqlx::query(
                "SELECT uuid, createdAt, wallet, asset_type, symbol, amount, value, price
                 FROM assets_v2",
            )
            .fetch_one(&mut conn)
            .await
            .unwrap();
            assert_eq!(modern_row.get::<String, _>("uuid"), "modern-batch");
            assert_eq!(
                modern_row.get::<String, _>("createdAt"),
                "2025-05-05 05:05:05"
            );
            assert_eq!(modern_row.get::<String, _>("wallet"), "broker-a");
            assert_eq!(modern_row.get::<String, _>("asset_type"), "stock");
            assert_eq!(modern_row.get::<String, _>("symbol"), "AAPL");
            assert_eq!(modern_row.get::<f64, _>("amount"), 4.0);
            assert_eq!(modern_row.get::<f64, _>("value"), 800.0);
            assert_eq!(modern_row.get::<f64, _>("price"), 200.0);
            let legacy_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets")
                .fetch_one(&mut conn)
                .await
                .unwrap();
            assert_eq!(legacy_count, 2);
            assert_eq!(configuration(&mut conn, 999).await, None);
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn v1t2_rebuilds_a_compatible_modern_destination_subset() {
        let root = make_temp_dir("compatible-modern-v1");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V01).await;
            let mut conn = connect(&database_path).await;
            create_compatible_modern_v1_destination(&mut conn).await;
            conn.close().await.unwrap();

            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            assert_current_schema_and_data(&database_path, 4, 5).await;
            assert_complete_legacy_asset_business_rows(&database_path).await;
        });

        fs::remove_dir_all(root).unwrap();
    }

    async fn assert_v1_dependent_row_rejected(
        dependent_table: &str,
        dependent_uuid: &str,
        dependent_asset_id: i64,
    ) {
        let root = make_temp_dir(&format!("v1-dependent-{dependent_table}"));
        let database_path = root.join("legacy.db");

        create_legacy_fixture(&database_path, LegacyVersion::V01).await;
        let mut conn = connect(&database_path).await;
        create_compatible_modern_v1_destination(&mut conn).await;
        if dependent_table == "asset_prices" {
            create_asset_prices(&mut conn).await;
            sqlx::query("UPDATE asset_prices SET uuid = ?, assetID = ? WHERE id = 1")
                .bind(dependent_uuid)
                .bind(dependent_asset_id)
                .execute(&mut conn)
                .await
                .unwrap();
        } else {
            create_legacy_transactions(&mut conn, true).await;
            sqlx::query(
                "INSERT INTO transactions (
                    uuid, assetID, asset_type, wallet, symbol, amount, price,
                    txnType, txnCreatedAt, createdAt
                 ) VALUES (
                    ?, ?, 'crypto', '', 'BTC', 2.0, 50.0,
                    'buy', '2024-01-01 01:02:03', '2024-01-01 01:02:03'
                 )",
            )
            .bind(dependent_uuid)
            .bind(dependent_asset_id)
            .execute(&mut conn)
            .await
            .unwrap();
        }
        conn.close().await.unwrap();

        let before = fs::read(&database_path).unwrap();
        let error = run_migrations(&database_path, &resource_dir(), "0.8.1")
            .await
            .unwrap_err();
        assert!(error.contains(dependent_table), "{error}");
        assert!(error.contains("row 1"), "{error}");
        assert!(
            error.contains(&format!("assetID {dependent_asset_id}")),
            "{error}"
        );
        assert_eq!(fs::read(&database_path).unwrap(), before);

        let mut conn = connect(&database_path).await;
        let legacy_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets")
            .fetch_one(&mut conn)
            .await
            .unwrap();
        let destination_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets_v2")
            .fetch_one(&mut conn)
            .await
            .unwrap();
        let dependent_count: i64 =
            sqlx::query_scalar(format!("SELECT COUNT(*) FROM {dependent_table}").as_str())
                .fetch_one(&mut conn)
                .await
                .unwrap();
        let persisted_dependent_asset_id: i64 =
            sqlx::query_scalar(format!("SELECT assetID FROM {dependent_table}").as_str())
                .fetch_one(&mut conn)
                .await
                .unwrap();
        let persisted_dependent_uuid: String =
            sqlx::query_scalar(format!("SELECT uuid FROM {dependent_table}").as_str())
                .fetch_one(&mut conn)
                .await
                .unwrap();
        assert_eq!(legacy_count, 2);
        assert_eq!(destination_count, 1);
        assert_eq!(dependent_count, 1);
        assert_eq!(persisted_dependent_uuid, dependent_uuid);
        assert_eq!(persisted_dependent_asset_id, dependent_asset_id);
        assert_eq!(configuration(&mut conn, 999).await, None);
        conn.close().await.unwrap();

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn v1t2_rejects_compatible_subset_with_asset_price_dependency() {
        Runtime::new()
            .unwrap()
            .block_on(assert_v1_dependent_row_rejected(
                "asset_prices",
                "fixture-price",
                1,
            ));
    }

    #[test]
    fn v1t2_rejects_compatible_subset_with_transaction_dependency() {
        Runtime::new()
            .unwrap()
            .block_on(assert_v1_dependent_row_rejected(
                "transactions",
                "dependent-transaction",
                1,
            ));
    }

    #[test]
    fn v1t2_rejects_uuid_linked_asset_price_with_previous_asset_id_without_mutation() {
        Runtime::new()
            .unwrap()
            .block_on(assert_v1_dependent_row_rejected(
                "asset_prices",
                "interrupted-modern-batch",
                77,
            ));
    }

    #[test]
    fn v1t2_rejects_orphan_transaction_asset_id_without_mutation() {
        Runtime::new()
            .unwrap()
            .block_on(assert_v1_dependent_row_rejected(
                "transactions",
                "unrelated-transaction-batch",
                77,
            ));
    }

    #[test]
    fn v1t2_rejects_null_legacy_timestamp_without_mutation() {
        let root = make_temp_dir("null-v1-timestamp");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V01).await;
            let mut conn = connect(&database_path).await;
            conn.execute("UPDATE assets SET createdAt = NULL WHERE id = 1")
                .await
                .unwrap();
            conn.close().await.unwrap();

            let before = fs::read(&database_path).unwrap();
            let error = run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap_err();
            assert!(
                error.contains("legacy assets row 1 has NULL createdAt"),
                "{error}"
            );
            assert_eq!(fs::read(&database_path).unwrap(), before);

            let mut conn = connect(&database_path).await;
            let timestamp: Option<String> =
                sqlx::query_scalar("SELECT createdAt FROM assets WHERE id = 1")
                    .fetch_one(&mut conn)
                    .await
                    .unwrap();
            assert_eq!(timestamp, None);
            assert!(!table_exists(&mut conn, "assets_v2").await);
            assert_eq!(configuration(&mut conn, 999).await, None);
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn historical_v03_marker_is_normalized_and_migrated() {
        let root = make_temp_dir("historical-v03-marker");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V03).await;
            let mut conn = connect(&database_path).await;
            conn.execute("UPDATE configuration SET data = 'v0.3' WHERE id = 999")
                .await
                .unwrap();
            conn.close().await.unwrap();

            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();
            assert_current_schema_and_data(&database_path, 1, 1).await;
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn v6t7_repairs_indexes_and_partial_transaction_schema() {
        let root = make_temp_dir("partial-v7");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V06).await;
            let mut conn = connect(&database_path).await;
            conn.execute(
                "ALTER TABLE assets_v2
                 ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'crypto'",
            )
            .await
            .unwrap();
            conn.close().await.unwrap();

            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            let mut conn = connect(&database_path).await;
            assert!(column_exists(&mut conn, "assets_v2", "asset_type").await);
            assert!(column_exists(&mut conn, "transactions", "asset_type").await);
            let old_index_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'index' AND name = 'unique_uuid_symbol_amount_wallet'",
            )
            .fetch_one(&mut conn)
            .await
            .unwrap();
            assert_eq!(old_index_count, 0);
            let index_columns =
                sqlx::query("PRAGMA index_info('unique_uuid_asset_type_symbol_wallet')")
                    .fetch_all(&mut conn)
                    .await
                    .unwrap()
                    .into_iter()
                    .map(|row| row.get::<String, _>("name"))
                    .collect::<Vec<_>>();
            assert_eq!(index_columns, ["uuid", "asset_type", "symbol", "wallet"]);
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn current_marker_repairs_missing_required_schema_without_backfill() {
        let root = make_temp_dir("current-schema-repair");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V07).await;
            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            let mut conn = connect(&database_path).await;
            conn.execute(
                "DROP INDEX unique_uuid_asset_type_symbol_wallet;
                 ALTER TABLE assets_v2 DROP COLUMN asset_type;
                 DROP TABLE asset_prices;
                 DROP TABLE transactions;
                 DROP TABLE chat_sessions;",
            )
            .await
            .unwrap();
            conn.close().await.unwrap();

            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            let mut conn = connect(&database_path).await;
            assert!(table_exists(&mut conn, "asset_prices").await);
            assert!(table_exists(&mut conn, "transactions").await);
            assert!(table_exists(&mut conn, "chat_sessions").await);
            assert!(column_exists(&mut conn, "assets_v2", "asset_type").await);
            assert!(column_exists(&mut conn, "transactions", "asset_type").await);
            assert!(index_exists(&mut conn, "unique_uuid_asset_type_symbol_wallet").await);
            assert!(index_exists(&mut conn, "unique_uuid_asset_id").await);
            assert!(index_exists(&mut conn, "txn_symbol_idx").await);
            assert!(index_exists(&mut conn, "chat_sessions_pinned_updated_idx").await);
            let transaction_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM transactions")
                .fetch_one(&mut conn)
                .await
                .unwrap();
            assert_eq!(transaction_count, 0);
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn current_marker_replaces_partial_unique_assets_index() {
        let root = make_temp_dir("partial-assets-index");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V07).await;
            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            let mut conn = connect(&database_path).await;
            conn.execute(
                "DROP INDEX unique_uuid_asset_type_symbol_wallet;
                 CREATE UNIQUE INDEX unique_uuid_asset_type_symbol_wallet
                 ON assets_v2 (uuid, asset_type, symbol, wallet)
                 WHERE amount > 0;",
            )
            .await
            .unwrap();
            conn.close().await.unwrap();

            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            let mut conn = connect(&database_path).await;
            let partial: i64 = sqlx::query_scalar(
                "SELECT partial FROM pragma_index_list('assets_v2')
                 WHERE name = 'unique_uuid_asset_type_symbol_wallet'",
            )
            .fetch_one(&mut conn)
            .await
            .unwrap();
            assert_eq!(partial, 0);
            let index_sql: String = sqlx::query_scalar(
                "SELECT sql FROM sqlite_master
                 WHERE type = 'index'
                   AND name = 'unique_uuid_asset_type_symbol_wallet'",
            )
            .fetch_one(&mut conn)
            .await
            .unwrap();
            assert!(!index_sql.to_ascii_uppercase().contains(" WHERE "));
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn current_marker_replaces_wrong_index_collation_and_direction() {
        let root = make_temp_dir("wrong-assets-index-metadata");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V07).await;
            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            let mut conn = connect(&database_path).await;
            conn.execute(
                "DROP INDEX unique_uuid_asset_type_symbol_wallet;
                 CREATE UNIQUE INDEX unique_uuid_asset_type_symbol_wallet
                 ON assets_v2 (
                    uuid COLLATE NOCASE DESC,
                    asset_type,
                    symbol,
                    wallet
                 );",
            )
            .await
            .unwrap();
            conn.close().await.unwrap();

            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            let mut conn = connect(&database_path).await;
            let assets_metadata = sqlx::query(
                "SELECT name, \"desc\", coll
                 FROM pragma_index_xinfo('unique_uuid_asset_type_symbol_wallet')
                 WHERE key = 1
                 ORDER BY seqno",
            )
            .fetch_all(&mut conn)
            .await
            .unwrap()
            .into_iter()
            .map(|row| {
                (
                    row.get::<String, _>("name"),
                    row.get::<i64, _>("desc"),
                    row.get::<String, _>("coll"),
                )
            })
            .collect::<Vec<_>>();
            assert_eq!(
                assets_metadata,
                [
                    ("uuid".to_string(), 0, "BINARY".to_string()),
                    ("asset_type".to_string(), 0, "BINARY".to_string()),
                    ("symbol".to_string(), 0, "BINARY".to_string()),
                    ("wallet".to_string(), 0, "BINARY".to_string()),
                ]
            );

            let chat_directions = sqlx::query_scalar::<_, i64>(
                "SELECT \"desc\"
                 FROM pragma_index_xinfo('chat_sessions_pinned_updated_idx')
                 WHERE key = 1
                 ORDER BY seqno",
            )
            .fetch_all(&mut conn)
            .await
            .unwrap();
            assert_eq!(chat_directions, [1, 1]);
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn missing_marker_on_modern_schema_repairs_without_historical_backfill() {
        let root = make_temp_dir("missing-modern-marker");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V07).await;
            let mut conn = connect(&database_path).await;
            conn.execute(
                "DELETE FROM configuration WHERE id = 999;
                 DROP TABLE IF EXISTS chat_sessions;",
            )
            .await
            .unwrap();
            conn.close().await.unwrap();

            run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            let mut conn = connect(&database_path).await;
            assert!(table_exists(&mut conn, "chat_sessions").await);
            let transaction_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM transactions")
                .fetch_one(&mut conn)
                .await
                .unwrap();
            assert_eq!(transaction_count, 0);
            assert_eq!(
                configuration(&mut conn, 999).await.as_deref(),
                Some("0.8.1")
            );
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn normalized_wallet_conflict_aborts_v4t5_without_partial_commit() {
        let root = make_temp_dir("wallet-conflict");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V04).await;
            let mut conn = connect(&database_path).await;
            conn.execute(
                "UPDATE assets_v2 SET wallet = NULL WHERE id = 1;
                 INSERT INTO assets_v2 (
                    uuid, createdAt, symbol, amount, value, price, wallet
                 ) VALUES (
                    'fixture-batch', '2024-01-02 00:00:00',
                    'BTC', 3.0, 180.0, 60.0, NULL
                 );",
            )
            .await
            .unwrap();
            conn.close().await.unwrap();

            let error = run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap_err();
            assert!(error.contains("conflicting assets_v2 rows"), "{error}");
            assert!(error.contains('1'), "{error}");
            assert!(error.contains('2'), "{error}");

            let mut conn = connect(&database_path).await;
            assert_eq!(
                configuration(&mut conn, 999).await.as_deref(),
                Some("0.4.0")
            );
            assert!(table_exists(&mut conn, "cloud_sync").await);
            assert!(!table_exists(&mut conn, "transactions").await);
            assert!(!index_exists(&mut conn, "unique_uuid_symbol_amount_wallet").await);
            let wallets =
                sqlx::query_scalar::<_, Option<String>>("SELECT wallet FROM assets_v2 ORDER BY id")
                    .fetch_all(&mut conn)
                    .await
                    .unwrap();
            assert_eq!(wallets, [None, None]);
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn future_database_version_is_rejected_without_mutation() {
        let root = make_temp_dir("future-version");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V07).await;
            let mut conn = connect(&database_path).await;
            conn.execute("UPDATE configuration SET data = '9.0.0' WHERE id = 999")
                .await
                .unwrap();
            conn.close().await.unwrap();

            let before = fs::read(&database_path).unwrap();
            let error = run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap_err();
            assert!(error.contains("newer than app version"), "{error}");
            assert_eq!(fs::read(&database_path).unwrap(), before);

            let mut conn = connect(&database_path).await;
            assert_eq!(
                configuration(&mut conn, 999).await.as_deref(),
                Some("9.0.0")
            );
            assert_eq!(configuration(&mut conn, 998).await, None);
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn v1t2_rejects_a_stale_assets_archive_collision_without_data_loss() {
        let root = make_temp_dir("assets-archive-collision");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V01).await;
            let mut conn = connect(&database_path).await;
            conn.execute(
                "CREATE TABLE assets_bak (marker TEXT NOT NULL);
                 INSERT INTO assets_bak (marker) VALUES ('do-not-overwrite');",
            )
            .await
            .unwrap();
            conn.close().await.unwrap();

            let error = run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap_err();
            assert!(error.contains("assets_bak"), "{error}");
            assert!(error.contains("already exists"), "{error}");

            let mut conn = connect(&database_path).await;
            assert!(table_exists(&mut conn, "assets").await);
            assert!(!table_exists(&mut conn, "assets_v2").await);
            let cloud_key: String = sqlx::query_scalar("SELECT publicKey FROM cloud_sync")
                .fetch_one(&mut conn)
                .await
                .unwrap();
            assert_eq!(cloud_key, "fixture-key");
            let source_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets")
                .fetch_one(&mut conn)
                .await
                .unwrap();
            assert_eq!(source_count, 2);
            let marker: String = sqlx::query_scalar("SELECT marker FROM assets_bak")
                .fetch_one(&mut conn)
                .await
                .unwrap();
            assert_eq!(marker, "do-not-overwrite");
            assert_eq!(configuration(&mut conn, 999).await, None);
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn failed_version_write_rolls_back_schema_data_and_version() {
        let root = make_temp_dir("rollback");
        let database_path = root.join("legacy.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&database_path, LegacyVersion::V04).await;
            let mut conn = connect(&database_path).await;
            conn.execute(
                "CREATE TRIGGER fail_migration_version
                 BEFORE UPDATE OF data ON configuration
                 WHEN OLD.id = 999
                 BEGIN
                     SELECT RAISE(ABORT, 'injected version write failure');
                 END",
            )
            .await
            .unwrap();
            conn.execute("UPDATE assets_v2 SET wallet = NULL WHERE id = 1")
                .await
                .unwrap();
            conn.close().await.unwrap();

            let error = run_migrations(&database_path, &resource_dir(), "0.8.1")
                .await
                .unwrap_err();
            assert!(error.contains("injected version write failure"), "{error}");

            let mut conn = connect(&database_path).await;
            assert_eq!(
                configuration(&mut conn, 999).await.as_deref(),
                Some("0.4.0")
            );
            assert!(table_exists(&mut conn, "cloud_sync").await);
            assert!(!table_exists(&mut conn, "transactions").await);
            let wallet: Option<String> =
                sqlx::query_scalar("SELECT wallet FROM assets_v2 WHERE id = 1")
                    .fetch_one(&mut conn)
                    .await
                    .unwrap();
            assert_eq!(wallet, None);
            conn.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn migration_updates_only_the_explicitly_selected_database_file() {
        let root = make_temp_dir("selected-file");
        let selected_database = root.join("selected %2F.db");
        let decoy_database = root.join("track3.db");
        let rt = Runtime::new().unwrap();

        rt.block_on(async {
            create_legacy_fixture(&selected_database, LegacyVersion::V07).await;
            create_legacy_fixture(&decoy_database, LegacyVersion::V07).await;

            run_migrations(&selected_database, &resource_dir(), "0.8.1")
                .await
                .unwrap();

            let mut selected = connect(&selected_database).await;
            let mut decoy = connect(&decoy_database).await;
            assert!(table_exists(&mut selected, "chat_sessions").await);
            assert!(!table_exists(&mut decoy, "chat_sessions").await);
            assert_eq!(
                configuration(&mut decoy, 999).await.as_deref(),
                Some("0.7.0")
            );
            selected.close().await.unwrap();
            decoy.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }
}

fn move_data_from_assets_and_assets_price_to_transactions(
    assets: Vec<MigrationAsset>,
    asset_prices: Vec<MigrationAssetPrice>,
) -> Vec<GeneratedTransaction> {
    if assets.is_empty() {
        return Vec::new();
    }
    let mut asset_prices_map = HashMap::<i32, f64>::new();
    for asset_price in asset_prices {
        asset_prices_map.insert(asset_price.asset_id, asset_price.price);
    }

    // get all uuids of assets
    let mut uuids = IndexSet::<String>::new();
    // sort assets by createdAt asc
    for asset in &assets {
        uuids.insert(asset.uuid.clone());
    }

    let mut last_grouped_assets = Vec::<MigrationAsset>::new();
    let mut transactions = Vec::<GeneratedTransaction>::new();

    for uuid in uuids {
        let grouped_assets = assets
            .iter()
            .filter(|asset| asset.uuid == uuid)
            .cloned()
            .collect::<Vec<MigrationAsset>>();

        // calculate transaction by grouped_assets and last_grouped_assets
        for asset in &grouped_assets {
            let mut last_asset: Option<&MigrationAsset> = None;
            // Find the previous snapshot row for the same business asset.
            for last_grouped_asset in &last_grouped_assets {
                if last_grouped_asset.wallet == asset.wallet
                    && last_grouped_asset.symbol == asset.symbol
                    && last_grouped_asset.asset_type == asset.asset_type
                {
                    last_asset = Some(last_grouped_asset);
                    break;
                }
            }

            let amount: f64;
            if let Some(last_asset) = last_asset {
                amount = asset.amount - last_asset.amount;
            } else {
                amount = asset.amount;
            }
            let price = asset_prices_map.get(&asset.id).unwrap_or(&asset.price);
            if amount == 0.0 {
                // if asset.symbol == "BTC" {
                //     println!("uuid: {}, asset: {:?}", uuid, asset);
                // }
                continue;
            }
            let mut txn_type = "buy";
            if amount > 0.0 {
                if *price == 0.0 {
                    txn_type = "deposit";
                }
            } else {
                if *price != 0.0 {
                    txn_type = "sell";
                } else {
                    txn_type = "withdraw";
                }
            }
            let transaction = GeneratedTransaction {
                uuid: uuid.clone(),
                asset_id: asset.id,
                asset_type: asset.asset_type.clone(),
                wallet: asset.wallet.clone().unwrap_or("".to_string()),
                symbol: asset.symbol.clone(),
                amount: amount.abs(),
                price: *price,
                txn_type: txn_type.to_string(),
                txn_created_at: asset.created_at.clone(),
                created_at: asset.created_at.clone(),
            };
            transactions.push(transaction);
        }

        for last_grouped_asset in &last_grouped_assets {
            let mut found = false;
            for asset in &grouped_assets {
                if last_grouped_asset.wallet == asset.wallet
                    && last_grouped_asset.symbol == asset.symbol
                    && last_grouped_asset.asset_type == asset.asset_type
                {
                    found = true;
                    break;
                }
            }

            if !found {
                let price = asset_prices_map
                    .get(&last_grouped_asset.id)
                    .unwrap_or(&last_grouped_asset.price);
                let mut txn_type = "sell";
                if price == &0.0 {
                    txn_type = "withdraw";
                }
                if last_grouped_asset.amount == 0.0 {
                    continue;
                }
                let transaction = GeneratedTransaction {
                    uuid: uuid.clone(),
                    asset_id: last_grouped_asset.id,
                    asset_type: last_grouped_asset.asset_type.clone(),
                    wallet: last_grouped_asset.wallet.clone().unwrap_or("".to_string()),
                    symbol: last_grouped_asset.symbol.clone(),
                    amount: last_grouped_asset.amount,
                    price: *price,
                    txn_type: txn_type.to_string(),
                    txn_created_at: last_grouped_asset.created_at.clone(),
                    created_at: last_grouped_asset.created_at.clone(),
                };
                transactions.push(transaction);
            }
        }

        last_grouped_assets = grouped_assets.clone();
    }

    transactions
}
