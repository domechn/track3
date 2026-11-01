#[path = "../../src/ent.rs"]
pub mod ent;
#[path = "../../src/info.rs"]
pub mod info;
#[path = "../../src/ios_backup_path.rs"]
pub mod ios_backup_path;
#[path = "../../src/ios_share_path.rs"]
pub mod ios_share_path;
#[path = "../../src/migration.rs"]
pub mod migration;
#[path = "../../src/refresh_persistence.rs"]
pub mod refresh_persistence;
#[path = "../../src/startup_security.rs"]
pub mod startup_security;
#[path = "../../src/sync_persistence.rs"]
pub mod sync_persistence;
#[path = "../../src/types.rs"]
pub mod types;

#[cfg(test)]
mod sync_tests {
    use super::sync_persistence::{
        delete_sync_snapshot, import_sync_snapshot, replace_import_snapshot, replace_sync_snapshot,
        save_sync_state, SnapshotStateRow,
    };
    use sqlx::{Connection, Executor, SqliteConnection};

    #[test]
    fn sync_state_save_rolls_back_snapshot_rows_if_global_write_fails() {
        let path =
            std::env::temp_dir().join(format!("track3-sync-save-{}.db", uuid::Uuid::new_v4()));
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let mut db = SqliteConnection::connect(&format!("sqlite://{}?mode=rwc", path.display())).await.unwrap();
            db.execute(include_str!("../../migrations/init/assets_v2_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/init/asset_prices_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/init/transactions_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/init/sync_state_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/init/sync_snapshot_state_up.sql")).await.unwrap();
            db.execute("INSERT INTO sync_state (id, data) VALUES (1, '{\"deviceId\":\"before\"}')").await.unwrap();
            db.execute("CREATE TRIGGER fail_global BEFORE UPDATE ON sync_state BEGIN SELECT RAISE(ABORT, 'injected failure'); END").await.unwrap();
            db.close().await.unwrap();
            let row = SnapshotStateRow {
                snapshot_id: "one".into(), snapshot_hash: Some("hash".into()), snapshot_edit: None,
                pending_snapshot_edit: None, published: 1, known: "[]".into(), asset_rows: Some("[\"asset\"]".into()),
                transaction_rows: None, row_events: Some("{\"row\":{}}".into()), transaction_events: None,
            };
            assert!(save_sync_state(&path, "{\"deviceId\":\"after\"}", &[row.clone()], &[], false).await.is_err());
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
            let global: String = sqlx::query_scalar("SELECT data FROM sync_state WHERE id = 1").fetch_one(&mut db).await.unwrap();
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_snapshot_state").fetch_one(&mut db).await.unwrap();
            assert_eq!(global, "{\"deviceId\":\"before\"}");
            assert_eq!(count, 0);
            db.execute("DROP TRIGGER fail_global").await.unwrap();
            db.close().await.unwrap();
            save_sync_state(&path, "{\"deviceId\":\"after\"}", &[row], &[], false).await.unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
            let events: String = sqlx::query_scalar("SELECT row_events FROM sync_snapshot_state WHERE snapshot_id = 'one'").fetch_one(&mut db).await.unwrap();
            assert_eq!(events, "{\"row\":{}}");
            db.close().await.unwrap();
        });
        std::fs::remove_file(path).unwrap();
    }


    #[test]
    fn import_replace_keeps_cost_prices_and_rejects_unmatched_prices() {
        let path = std::env::temp_dir().join(format!("track3-import-prices-{}.db", uuid::Uuid::new_v4()));
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let mut db = SqliteConnection::connect(&format!("sqlite://{}?mode=rwc", path.display())).await.unwrap();
            db.execute(include_str!("../../migrations/init/assets_v2_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/init/asset_prices_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/init/transactions_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/v08t09/sync_state_up.sql")).await.unwrap();
            db.execute("INSERT INTO assets_v2 (uuid, wallet, symbol, amount, value, price) VALUES ('one', 'wallet', 'BTC', 1, 3, 3)").await.unwrap();
            db.execute("INSERT INTO asset_prices (uuid, assetID, symbol, price, assetCreatedAt, updatedAt) SELECT 'one', id, 'BTC', 2, '2024-01-01', '2024-01-02' FROM assets_v2 WHERE uuid = 'one'").await.unwrap();
            let revision_before: i64 = sqlx::query_scalar("SELECT revision FROM sync_snapshot_revisions WHERE uuid = 'one'").fetch_one(&mut db).await.unwrap();
            db.close().await.unwrap();
            let replacement = serde_json::json!({
                "uuid": "one",
                "assets": [{"id": 77, "uuid": "one", "createdAt": "2024-01-01", "wallet": "wallet", "asset_type": "crypto", "symbol": "BTC", "amount": 2, "value": 8, "price": 4}],
                "prices": [],
                "transactions": []
            });
            replace_import_snapshot(&path, replacement.clone()).await.unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
            let row: (f64, i64, i64) = sqlx::query_as("SELECT p.price, p.assetID, a.id FROM asset_prices p JOIN assets_v2 a ON a.id = p.assetID WHERE p.uuid = 'one'").fetch_one(&mut db).await.unwrap();
            assert_eq!(row.0, 2.0);
            assert_eq!(row.1, row.2);
            let revision_after: i64 = sqlx::query_scalar("SELECT revision FROM sync_snapshot_revisions WHERE uuid = 'one'").fetch_one(&mut db).await.unwrap();
            assert!(revision_after > revision_before);
            db.close().await.unwrap();

            let mut unmatched = replacement;
            unmatched["assets"][0]["symbol"] = serde_json::json!("ETH");
            assert!(replace_import_snapshot(&path, unmatched).await.is_err());
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
            let row: (String, f64) = sqlx::query_as("SELECT a.symbol, p.price FROM asset_prices p JOIN assets_v2 a ON a.id = p.assetID WHERE p.uuid = 'one'").fetch_one(&mut db).await.unwrap();
            assert_eq!(row, ("BTC".into(), 2.0));
            db.execute("INSERT INTO asset_prices (uuid, assetID, symbol, price, assetCreatedAt, updatedAt) VALUES ('one', 99999, 'ORPHAN', 7, '2024-01-01', '2024-01-02')").await.unwrap();
            db.close().await.unwrap();
            let original = serde_json::json!({
                "uuid": "one",
                "assets": [{"id": 77, "uuid": "one", "createdAt": "2024-01-01", "wallet": "wallet", "asset_type": "crypto", "symbol": "BTC", "amount": 2, "value": 8, "price": 4}],
                "prices": [],
                "transactions": []
            });
            assert!(replace_import_snapshot(&path, original).await.is_err());
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM asset_prices WHERE uuid = 'one'").fetch_one(&mut db).await.unwrap();
            assert_eq!(count, 2);
            db.close().await.unwrap();
        });
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn snapshot_revision_tracks_insert_update_and_delete() {
        let path = std::env::temp_dir().join(format!("track3-sync-revisions-{}.db", uuid::Uuid::new_v4()));
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let mut db = SqliteConnection::connect(&format!("sqlite://{}?mode=rwc", path.display())).await.unwrap();
            db.execute(include_str!("../../migrations/init/assets_v2_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/init/asset_prices_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/init/transactions_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/v08t09/sync_state_up.sql")).await.unwrap();
            db.execute("INSERT INTO assets_v2 (uuid, wallet, symbol, amount, value, price) VALUES ('one', '', 'BTC', 1, 1, 1)").await.unwrap();
            let first: i64 = sqlx::query_scalar("SELECT revision FROM sync_snapshot_revisions WHERE uuid = 'one'")
                .fetch_one(&mut db).await.unwrap();
            db.execute("UPDATE assets_v2 SET amount = 2 WHERE uuid = 'one'").await.unwrap();
            let second: i64 = sqlx::query_scalar("SELECT revision FROM sync_snapshot_revisions WHERE uuid = 'one'")
                .fetch_one(&mut db).await.unwrap();
            assert!(second > first);
            db.execute("DELETE FROM assets_v2 WHERE uuid = 'one'").await.unwrap();
            let third: i64 = sqlx::query_scalar("SELECT revision FROM sync_snapshot_revisions WHERE uuid = 'one'")
                .fetch_one(&mut db).await.unwrap();
            assert!(third > second);
            db.close().await.unwrap();
        });
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn imported_snapshot_remaps_ids_and_is_atomic_and_idempotent() {
        let path = std::env::temp_dir().join(format!("track3-sync-{}.db", uuid::Uuid::new_v4()));
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let mut db = SqliteConnection::connect(&format!("sqlite://{}?mode=rwc", path.display())).await.unwrap();
            db.execute(include_str!("../../migrations/init/assets_v2_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/init/asset_prices_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/init/transactions_up.sql")).await.unwrap();
            db.execute(include_str!("../../migrations/v08t09/sync_state_up.sql")).await.unwrap();
            db.execute("INSERT INTO assets_v2 (uuid, wallet, symbol, amount, value, price) VALUES ('local', '', 'BTC', 1, 1, 1)").await.unwrap();
            db.close().await.unwrap();

            let broken = serde_json::json!({
                "uuid": "broken",
                "assets": [{"id": 2, "uuid": "broken", "createdAt": "2026-01-01", "wallet": "", "asset_type": "crypto", "symbol": "ETH", "amount": 2, "value": 4, "price": 2},
                    {"id": 2, "uuid": "broken", "createdAt": "2026-01-01", "wallet": "", "asset_type": "crypto", "symbol": "SOL", "amount": 2, "value": 4, "price": 2}],
                "prices": [],
                "transactions": []
            });
            assert!(import_sync_snapshot(&path, broken).await.is_err());
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets_v2 WHERE uuid = 'broken'").fetch_one(&mut db).await.unwrap();
            assert_eq!(count, 0);
            db.close().await.unwrap();

            let snapshot = serde_json::json!({
                "uuid": "remote",
                "assets": [{"id": 1, "uuid": "remote", "createdAt": "2026-01-01", "wallet": "", "asset_type": "crypto", "symbol": "ETH", "amount": 2, "value": 4, "price": 2}],
                "prices": [{"id": 1, "uuid": "remote", "assetID": 1, "symbol": "ETH", "price": 2, "assetCreatedAt": "2026-01-01", "updatedAt": "2026-01-01"}],
                "transactions": [{"id": 1, "uuid": "remote", "assetID": 1, "asset_type": "crypto", "wallet": "", "symbol": "ETH", "amount": 2, "price": 2, "txnType": "buy", "txnCreatedAt": "2026-01-01", "createdAt": "2026-01-01", "updatedAt": "2026-01-01"}]
            });
            assert!(import_sync_snapshot(&path, snapshot.clone()).await.unwrap());
            assert!(!import_sync_snapshot(&path, snapshot.clone()).await.unwrap());
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
            let asset_id: i64 = sqlx::query_scalar("SELECT id FROM assets_v2 WHERE uuid = 'remote'").fetch_one(&mut db).await.unwrap();
            let price_asset_id: i64 = sqlx::query_scalar("SELECT assetID FROM asset_prices WHERE uuid = 'remote'").fetch_one(&mut db).await.unwrap();
            let txn_asset_id: i64 = sqlx::query_scalar("SELECT assetID FROM transactions WHERE uuid = 'remote'").fetch_one(&mut db).await.unwrap();
            assert_ne!(asset_id, 1);
            assert_eq!(price_asset_id, asset_id);
            assert_eq!(txn_asset_id, asset_id);
            db.close().await.unwrap();
            delete_sync_snapshot(&path, "remote").await.unwrap();
            assert!(import_sync_snapshot(&path, snapshot).await.unwrap());
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
            let price_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM asset_prices WHERE uuid = 'remote'").fetch_one(&mut db).await.unwrap();
            let txn_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM transactions WHERE uuid = 'remote'").fetch_one(&mut db).await.unwrap();
            assert_eq!((price_count, txn_count), (1, 1));
            db.close().await.unwrap();

            let orphan = serde_json::json!({
                "uuid": "orphan",
                "assets": [{"id": 2, "uuid": "orphan", "createdAt": "2026-01-01", "wallet": "", "asset_type": "crypto", "symbol": "ETH", "amount": 2, "value": 4, "price": 2}],
                "prices": [{"uuid": "orphan", "assetID": 99, "symbol": "OLD", "price": 2, "assetCreatedAt": "2026-01-01", "updatedAt": "2026-01-01"}],
                "transactions": []
            });
            assert!(import_sync_snapshot(&path, orphan).await.unwrap());

            let replacement = serde_json::json!({
                "uuid": "remote",
                "assets": [{"id": 5, "uuid": "remote", "createdAt": "2026-01-01", "wallet": "", "asset_type": "crypto", "symbol": "ETH", "amount": 2, "value": 4, "price": 2}],
                "prices": [],
                "transactions": [{"uuid": "remote", "assetID": 5, "asset_type": "crypto", "wallet": "", "symbol": "ETH", "amount": 2, "price": 9, "txnType": "buy", "txnCreatedAt": "2026-01-01", "createdAt": "2026-01-01", "updatedAt": "2026-01-02"}]
            });
            let mut invalid = replacement.clone();
            let duplicate = invalid["assets"][0].clone();
            invalid["assets"].as_array_mut().unwrap().push(duplicate);
            assert!(replace_sync_snapshot(&path, invalid).await.is_err());
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
            let original_price: f64 = sqlx::query_scalar("SELECT price FROM transactions WHERE uuid = 'remote'").fetch_one(&mut db).await.unwrap();
            assert_eq!(original_price, 2.0);
            db.close().await.unwrap();
            replace_sync_snapshot(&path, replacement).await.unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
            let changed_price: f64 = sqlx::query_scalar("SELECT price FROM transactions WHERE uuid = 'remote'").fetch_one(&mut db).await.unwrap();
            assert_eq!(changed_price, 9.0);
            db.close().await.unwrap();

            let partial = serde_json::json!({
                "uuid": "partial",
                "assets": [
                    {"id": 10, "uuid": "partial", "createdAt": "2026-01-01", "wallet": "", "asset_type": "crypto", "symbol": "BTC", "amount": 1, "value": 1, "price": 1},
                    {"id": 11, "uuid": "partial", "createdAt": "2026-01-01", "wallet": "", "asset_type": "crypto", "symbol": "ETH", "amount": 1, "value": 1, "price": 1}
                ],
                "prices": [
                    {"uuid": "partial", "assetID": 10, "symbol": "BTC", "price": 1, "assetCreatedAt": "2026-01-01", "updatedAt": "2026-01-01"},
                    {"uuid": "partial", "assetID": 11, "symbol": "ETH", "price": 1, "assetCreatedAt": "2026-01-01", "updatedAt": "2026-01-01"}
                ],
                "transactions": []
            });
            import_sync_snapshot(&path, partial).await.unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
            let btc_id: i64 = sqlx::query_scalar("SELECT id FROM assets_v2 WHERE uuid = 'partial' AND symbol = 'BTC'").fetch_one(&mut db).await.unwrap();
            let eth_id: i64 = sqlx::query_scalar("SELECT id FROM assets_v2 WHERE uuid = 'partial' AND symbol = 'ETH'").fetch_one(&mut db).await.unwrap();
            sqlx::query("DELETE FROM assets_v2 WHERE id = ?").bind(btc_id).execute(&mut db).await.unwrap();
            db.close().await.unwrap();
            let undo = serde_json::json!({
                "uuid": "partial",
                "assets": [{"id": eth_id, "uuid": "partial", "createdAt": "2026-01-01", "wallet": "", "asset_type": "crypto", "symbol": "ETH", "amount": 1, "value": 1, "price": 1}],
                "prices": [
                    {"uuid": "partial", "assetID": btc_id, "symbol": "BTC", "price": 1, "assetCreatedAt": "2026-01-01", "updatedAt": "2026-01-01"},
                    {"uuid": "partial", "assetID": eth_id, "symbol": "ETH", "price": 1, "assetCreatedAt": "2026-01-01", "updatedAt": "2026-01-01"}
                ],
                "transactions": []
            });
            delete_sync_snapshot(&path, "partial").await.unwrap();
            import_sync_snapshot(&path, undo).await.unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
            let assets: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets_v2 WHERE uuid = 'partial'").fetch_one(&mut db).await.unwrap();
            let prices: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM asset_prices WHERE uuid = 'partial'").fetch_one(&mut db).await.unwrap();
            assert_eq!((assets, prices), (1, 1));
            db.close().await.unwrap();
        });
        std::fs::remove_file(path).unwrap();
    }
}

#[cfg(test)]
mod init_schema_tests {
    use super::migration::run_migrations;
    use super::sync_persistence::SnapshotStateRow;
    use sha2::{Digest, Sha256};
    use sqlx::{Connection, Executor, SqliteConnection};
    use std::path::{Path, PathBuf};

    const NEW_TABLE_SCRIPTS: [(&str, &str, &str); 4] = [
        ("rebalance_profiles_up.sql", include_str!("../../migrations/init/rebalance_profiles_up.sql"), include_str!("../../migrations/v08t09/rebalance_profiles_up.sql")),
        ("alerts_up.sql", include_str!("../../migrations/init/alerts_up.sql"), include_str!("../../migrations/v08t09/alerts_up.sql")),
        ("history_snapshots_up.sql", include_str!("../../migrations/init/history_snapshots_up.sql"), include_str!("../../migrations/v08t09/history_snapshots_up.sql")),
        ("sync_state_up.sql", include_str!("../../migrations/init/sync_state_up.sql"), include_str!("../../migrations/v08t09/sync_state_up.sql")),
    ];

    fn initialization_scripts() -> Vec<&'static str> {
        include_str!("../../src/database_path.rs")
            .split_once("const INITIALIZATION_SCRIPTS:")
            .unwrap()
            .1
            .split_once("];")
            .unwrap()
            .0
            .lines()
            .filter_map(|line| line.trim().strip_prefix('"')?.split('"').next())
            .collect()
    }

    #[test]
    fn init_and_versioned_copies_of_the_new_tables_are_identical_and_registered() {
        for (name, init, versioned) in NEW_TABLE_SCRIPTS {
            assert_eq!(init, versioned, "{name} differs between init and v08t09");
            assert!(initialization_scripts().contains(&name), "{name} missing from INITIALIZATION_SCRIPTS");
        }
        let additive = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../migrations/v094t095");
        for entry in std::fs::read_dir(additive).unwrap() {
            let entry = entry.unwrap();
            let name = entry.file_name().into_string().unwrap();
            if !name.ends_with("_up.sql") { continue }
            let init = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../migrations/init").join(&name);
            assert_eq!(std::fs::read(entry.path()).unwrap(), std::fs::read(init).unwrap(), "{name} differs from init");
            assert!(initialization_scripts().contains(&name.as_str()), "{name} missing from INITIALIZATION_SCRIPTS");
        }
    }

    #[test]
    fn fresh_install_scripts_create_every_table_and_survive_the_0_9_0_migration() {
        let root = std::env::temp_dir().join(format!("track3-fresh-init-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let db_path: PathBuf = root.join("fresh.db");
        let resource_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let mut db = SqliteConnection::connect(&format!("sqlite://{}?mode=rwc", db_path.display())).await.unwrap();
            for name in initialization_scripts() {
                let sql = std::fs::read_to_string(resource_dir.join("migrations/init").join(name)).unwrap();
                db.execute(sql.as_str()).await.unwrap();
            }
            db.close().await.unwrap();
            run_migrations(&db_path, &resource_dir, "0.9.0").await.unwrap();
            run_migrations(&db_path, &resource_dir, "0.9.0").await.unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display())).await.unwrap();
            for table in ["rebalance_profiles", "alert_rules", "alert_history", "history_snapshots", "sync_state", "sync_applied_objects", "sync_snapshot_revisions", "sync_manifest_cache"] {
                let found: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?")
                    .bind(table).fetch_one(&mut db).await.unwrap();
                assert_eq!(found, 1, "{table} missing after a fresh install");
            }
            db.close().await.unwrap();
        });
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn existing_0_9_4_database_gains_manifest_cache_before_version_bump() {
        let root = std::env::temp_dir().join(format!("track3-sync-cache-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("existing.db");
        let resource_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let mut db = SqliteConnection::connect(&format!("sqlite://{}?mode=rwc", db_path.display())).await.unwrap();
            for name in initialization_scripts().into_iter().filter(|name| *name != "sync_manifest_cache_up.sql") {
                let sql = std::fs::read_to_string(resource_dir.join("migrations/init").join(name)).unwrap();
                db.execute(sql.as_str()).await.unwrap();
            }
            db.execute("INSERT INTO configuration (id, data) VALUES (999, '0.9.4')").await.unwrap();
            let before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'sync_manifest_cache'")
                .fetch_one(&mut db).await.unwrap();
            assert_eq!(before, 0);
            db.close().await.unwrap();

            run_migrations(&db_path, &resource_dir, "0.9.4").await.unwrap();
            run_migrations(&db_path, &resource_dir, "0.9.4").await.unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display())).await.unwrap();
            let version: String = sqlx::query_scalar("SELECT data FROM configuration WHERE id = 999")
                .fetch_one(&mut db).await.unwrap();
            assert_eq!(version, "0.9.4");
            let after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'sync_manifest_cache'")
                .fetch_one(&mut db).await.unwrap();
            assert_eq!(after, 1);
            db.close().await.unwrap();
        });
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn migrates_current_engine_state_with_5000_snapshots_without_losing_events() {
        let root = std::env::temp_dir().join(format!("track3-sync-split-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("state.db");
        let resource_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let mut db = SqliteConnection::connect(&format!("sqlite://{}?mode=rwc", db_path.display())).await.unwrap();
            for name in initialization_scripts().into_iter().filter(|name| *name != "sync_snapshot_state_up.sql") {
                db.execute(std::fs::read_to_string(resource_dir.join("migrations/init").join(name)).unwrap().as_str()).await.unwrap();
            }
            db.execute("INSERT INTO configuration (id, data) VALUES (999, '0.9.4')").await.unwrap();
            let mut legacy: serde_json::Value = serde_json::from_str(include_str!("../../../tests/fixtures/sync-state-current-engine.json")).unwrap();
            let example = legacy["assetRows"]["snapshot-000000"][0].clone();
            let event = serde_json::json!({"deleted":true,"clock":{"ms":1713272400000_i64,"counter":1,"deviceId":"00000000-0000-4000-8000-000000000001"}});
            for index in 0..5000 {
                let id = format!("snapshot-{index:06}");
                legacy["snapshotHashes"][&id] = serde_json::json!(format!("hash-{index}"));
                legacy["assetRows"][&id] = serde_json::Value::Array((0..50).map(|asset| serde_json::json!(format!("{example}-{asset}"))).collect());
                legacy["transactionRows"][&id] = serde_json::json!({"txn":{"price":index,"txnType":"buy"}});
                legacy["rowEvents"][&id] = serde_json::json!({"row":event});
                legacy["transactionEvents"][&id] = serde_json::json!({"txn":{"price":{"value":index,"clock":event["clock"]}}});
                legacy["snapshotEdits"][&id] = event["clock"].clone();
                legacy["pendingSnapshotEdits"][&id] = event["clock"].clone();
                if index > 0 {
                    legacy["published"].as_array_mut().unwrap().push(serde_json::json!(id));
                    legacy["known"].as_array_mut().unwrap().push(serde_json::json!(format!("00000000-0000-4000-8000-000000000001:snapshot:{id}:1")));
                }
            }
            let old = legacy.to_string();
            sqlx::query("INSERT INTO sync_state (id, data) VALUES (1, ?)").bind(&old).execute(&mut db).await.unwrap();
            db.close().await.unwrap();
            run_migrations(&db_path, &resource_dir, "0.9.4").await.unwrap();
            run_migrations(&db_path, &resource_dir, "0.9.4").await.unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display())).await.unwrap();
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_snapshot_state").fetch_one(&mut db).await.unwrap();
            assert_eq!(count, 5000);
            let compact: String = sqlx::query_scalar("SELECT data FROM sync_state WHERE id = 1").fetch_one(&mut db).await.unwrap();
            assert!(compact.len() < 3000, "global state is still proportional to history");
            let row: (String, String, String) = sqlx::query_as(
                "SELECT asset_rows, row_events, transaction_events FROM sync_snapshot_state WHERE snapshot_id = 'snapshot-004999'"
            ).fetch_one(&mut db).await.unwrap();
            assert_eq!(serde_json::from_str::<serde_json::Value>(&row.0).unwrap().as_array().unwrap().len(), 50);
            assert_eq!(serde_json::from_str::<serde_json::Value>(&row.1).unwrap()["row"], event);
            assert_eq!(serde_json::from_str::<serde_json::Value>(&row.2).unwrap()["txn"]["price"]["value"], 4999);
            let stored: Vec<SnapshotStateRow> = sqlx::query_as(
                "SELECT snapshot_id, snapshot_hash, snapshot_edit, pending_snapshot_edit, published,
                        known, asset_rows, transaction_rows, row_events, transaction_events
                 FROM sync_snapshot_state ORDER BY snapshot_id"
            ).fetch_all(&mut db).await.unwrap();
            let mut rebuilt: serde_json::Value = serde_json::from_str(&compact).unwrap();
            for field in ["snapshotHashes", "snapshotEdits", "pendingSnapshotEdits", "assetRows",
                "transactionRows", "rowEvents", "transactionEvents"] {
                rebuilt[field] = serde_json::json!({});
            }
            rebuilt["published"] = serde_json::json!([]);
            for row in stored {
                if let Some(hash) = row.snapshot_hash {
                    rebuilt["snapshotHashes"][&row.snapshot_id] = serde_json::json!(hash);
                }
                for (field, value) in [
                    ("snapshotEdits", row.snapshot_edit), ("pendingSnapshotEdits", row.pending_snapshot_edit),
                    ("assetRows", row.asset_rows), ("transactionRows", row.transaction_rows),
                    ("rowEvents", row.row_events), ("transactionEvents", row.transaction_events),
                ] {
                    if let Some(value) = value {
                        rebuilt[field][&row.snapshot_id] = serde_json::from_str(&value).unwrap();
                    }
                }
                if row.published != 0 {
                    rebuilt["published"].as_array_mut().unwrap().push(serde_json::json!(row.snapshot_id));
                }
                rebuilt["known"].as_array_mut().unwrap().extend(
                    serde_json::from_str::<Vec<serde_json::Value>>(&row.known).unwrap()
                );
            }
            for value in [&mut rebuilt, &mut legacy] {
                for field in ["known", "published"] {
                    value[field].as_array_mut().unwrap().sort_by(|a, b| a.as_str().cmp(&b.as_str()));
                }
            }
            assert_eq!(rebuilt, legacy, "every migrated snapshot field must round-trip");
            db.close().await.unwrap();
        });
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn failed_snapshot_state_migration_keeps_legacy_row_for_retry() {
        let root = std::env::temp_dir().join(format!(
            "track3-sync-split-rollback-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("state.db");
        let resource_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let old = include_str!("../../../tests/fixtures/sync-state-current-engine.json").trim();
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let mut db = SqliteConnection::connect(&format!("sqlite://{}?mode=rwc", db_path.display())).await.unwrap();
            for name in initialization_scripts() {
                db.execute(std::fs::read_to_string(resource_dir.join("migrations/init").join(name)).unwrap().as_str()).await.unwrap();
            }
            db.execute("INSERT INTO configuration (id, data) VALUES (999, '0.9.4')").await.unwrap();
            sqlx::query("INSERT INTO sync_state (id, data) VALUES (1, ?)").bind(old).execute(&mut db).await.unwrap();
            db.execute("CREATE TRIGGER fail_split AFTER INSERT ON sync_snapshot_state BEGIN UPDATE sync_snapshot_state SET known = '[]' WHERE snapshot_id = NEW.snapshot_id; END").await.unwrap();
            db.close().await.unwrap();
            assert!(run_migrations(&db_path, &resource_dir, "0.9.4").await.unwrap_err().contains("hash mismatch"));
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display())).await.unwrap();
            let after: String = sqlx::query_scalar("SELECT data FROM sync_state WHERE id = 1").fetch_one(&mut db).await.unwrap();
            assert_eq!(after, old);
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_snapshot_state").fetch_one(&mut db).await.unwrap();
            assert_eq!(count, 0);
            db.execute("DROP TRIGGER fail_split").await.unwrap();
            let mut malformed: serde_json::Value = serde_json::from_str(old).unwrap();
            malformed["snapshotHashes"]["snapshot-000000"] = serde_json::json!(5);
            let malformed = malformed.to_string();
            sqlx::query("UPDATE sync_state SET data = ? WHERE id = 1").bind(&malformed).execute(&mut db).await.unwrap();
            db.close().await.unwrap();
            assert!(run_migrations(&db_path, &resource_dir, "0.9.4").await.is_err());
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display())).await.unwrap();
            let after: String = sqlx::query_scalar("SELECT data FROM sync_state WHERE id = 1").fetch_one(&mut db).await.unwrap();
            assert_eq!(after, malformed);
            sqlx::query("UPDATE sync_state SET data = ? WHERE id = 1").bind(old).execute(&mut db).await.unwrap();
            db.close().await.unwrap();
            run_migrations(&db_path, &resource_dir, "0.9.4").await.unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display())).await.unwrap();
            let data: String = sqlx::query_scalar("SELECT data FROM sync_state WHERE id = 1")
                .fetch_one(&mut db).await.unwrap();
            let rows: Vec<SnapshotStateRow> = sqlx::query_as(
                "SELECT snapshot_id, snapshot_hash, snapshot_edit, pending_snapshot_edit, published,
                        known, asset_rows, transaction_rows, row_events, transaction_events
                 FROM sync_snapshot_state ORDER BY snapshot_id"
            ).fetch_all(&mut db).await.unwrap();
            let migrated = serde_json::json!({ "data": data, "rows": rows });
            let fixture = resource_dir.canonicalize().unwrap().parent().unwrap()
                .join("tests/fixtures/sync-state-migrated-current.json");
            if std::env::var("UPDATE_GOLDEN").as_deref() == Ok("1") {
                std::fs::write(&fixture, format!("{}\n", serde_json::to_string_pretty(&migrated).unwrap())).unwrap();
            }
            let expected: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(fixture).unwrap()).unwrap();
            assert_eq!(migrated, expected, "migrated rows must match the fixture loaded by TypeScript");
            db.close().await.unwrap();
        });
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn v094t095_repair_applies_registered_scripts_idempotently() {
        let source = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let root = std::env::temp_dir().join(format!("track3-additive-migration-{}", uuid::Uuid::new_v4()));
        let db_path = root.join("database.db");
        for directory in ["init", "v08t09"] {
            let destination = root.join("migrations").join(directory);
            std::fs::create_dir_all(&destination).unwrap();
            for file in std::fs::read_dir(source.join("migrations").join(directory)).unwrap() {
                let file = file.unwrap();
                std::fs::copy(file.path(), destination.join(file.file_name())).unwrap();
            }
        }
        let additive = root.join("migrations/v094t095");
        std::fs::create_dir_all(&additive).unwrap();
        std::fs::write(additive.join("compat_probe_up.sql"), "CREATE TABLE IF NOT EXISTS compat_probe (id INTEGER PRIMARY KEY);").unwrap();
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let mut db = SqliteConnection::connect(&format!("sqlite://{}?mode=rwc", db_path.display())).await.unwrap();
            for name in initialization_scripts() {
                let sql = std::fs::read_to_string(root.join("migrations/init").join(name)).unwrap();
                db.execute(sql.as_str()).await.unwrap();
            }
            db.close().await.unwrap();
            run_migrations(&db_path, &root, "0.9.4").await.unwrap();
            run_migrations(&db_path, &root, "0.9.5").await.unwrap();
            run_migrations(&db_path, &root, "0.9.5").await.unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display())).await.unwrap();
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='compat_probe'")
                .fetch_one(&mut db).await.unwrap();
            assert_eq!(count, 1);
            db.close().await.unwrap();
        });
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn write_forward_database_fixture() {
        let Ok(directory) = std::env::var("TRACK3_COMPAT_FORWARD") else { return };
        let resource_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let db_path = PathBuf::from(directory).join("migrated.db");
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let mut db = SqliteConnection::connect(&format!("sqlite://{}?mode=rwc", db_path.display())).await.unwrap();
            for name in initialization_scripts() {
                let sql = std::fs::read_to_string(resource_dir.join("migrations/init").join(name)).unwrap();
                db.execute(sql.as_str()).await.unwrap();
            }
            db.close().await.unwrap();
            run_migrations(&db_path, &resource_dir, "0.9.4").await.unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display())).await.unwrap();
            db.execute("INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES ('db-compat', '2024-04-16T13:00:00.000Z', 'wallet-compat', 'crypto', 'BTC', 2, 4, 2)").await.unwrap();
            db.execute("INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType) VALUES ('db-compat', 1, 'crypto', 'wallet-compat', 'BTC', 2, 2, 'buy')").await.unwrap();
            db.close().await.unwrap();
            run_migrations(&db_path, &resource_dir, "0.9.5").await.unwrap();
        });
    }

    // The 0.9.4 schema stays frozen; additions require their own reviewed fixture.
    #[test]
    fn schema_is_frozen_0_9_4_subset_plus_reviewed_additions() {
        let resource_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let fixture_dir = resource_dir.join("tests/fixtures");
        let root =
            std::env::temp_dir().join(format!("track3-schema-golden-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("fresh.db");
        let runtime = tokio::runtime::Runtime::new().unwrap();
        let schema = runtime.block_on(async {
            let mut db = SqliteConnection::connect(&format!("sqlite://{}?mode=rwc", db_path.display())).await.unwrap();
            for name in initialization_scripts() {
                let sql = std::fs::read_to_string(resource_dir.join("migrations/init").join(name)).unwrap();
                db.execute(sql.as_str()).await.unwrap();
            }
            db.close().await.unwrap();
            run_migrations(&db_path, &resource_dir, "0.9.4")
                .await
                .unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display()))
                .await
                .unwrap();
            let rows: Vec<(String, String, String, Option<String>)> =
                sqlx::query_as("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY name")
                    .fetch_all(&mut db)
                    .await
                    .unwrap();
            db.close().await.unwrap();
            rows.into_iter()
                .map(|row| serde_json::to_string(&row).unwrap())
                .collect::<Vec<_>>()
                .join("\n")
                + "\n"
        });
        std::fs::remove_dir_all(root).unwrap();

        fn collect_sql_files(dir: &Path, scripts: &mut Vec<PathBuf>) {
            for entry in std::fs::read_dir(dir).unwrap() {
                let entry = entry.unwrap();
                let path = entry.path();
                if path.is_dir() {
                    collect_sql_files(&path, scripts);
                } else if path.extension().is_some_and(|ext| ext == "sql") {
                    scripts.push(path);
                }
            }
        }
        let mut scripts = Vec::new();
        collect_sql_files(&resource_dir.join("migrations"), &mut scripts);
        scripts.sort();
        let hashes = scripts
            .iter()
            .map(|path| {
                let hash = Sha256::digest(std::fs::read(path).unwrap());
                let relative = path.strip_prefix(&resource_dir).unwrap();
                format!("{hash:x}  {}", relative.display())
            })
            .collect::<Vec<_>>()
            .join("\n")
            + "\n";
        let frozen_schema = std::fs::read_to_string(fixture_dir.join("schema-0.9.4.txt")).unwrap();
        let actual_lines = schema.lines().collect::<std::collections::BTreeSet<_>>();
        let frozen_lines = frozen_schema.lines().collect::<std::collections::BTreeSet<_>>();
        assert!(frozen_lines.is_subset(&actual_lines), "a 0.9.4 schema object changed or disappeared");
        let additions = actual_lines.difference(&frozen_lines).copied().collect::<Vec<_>>().join("\n");
        let additions = format!("{additions}{}", if additions.is_empty() { "" } else { "\n" });
        if std::env::var("UPDATE_GOLDEN").as_deref() == Ok("1") {
            std::fs::write(fixture_dir.join("schema-0.9.5-additions.txt"), &additions).unwrap();
        }
        let reviewed_schema = std::fs::read_to_string(fixture_dir.join("schema-0.9.5-additions.txt")).unwrap();
        assert_eq!(additions, reviewed_schema);

        let frozen_hashes = std::fs::read_to_string(fixture_dir.join("migrations.sha256")).unwrap();
        let actual_hashes = hashes.lines().collect::<std::collections::BTreeSet<_>>();
        let frozen_hash_lines = frozen_hashes.lines().collect::<std::collections::BTreeSet<_>>();
        assert!(frozen_hash_lines.is_subset(&actual_hashes), "a 0.9.4 migration SQL file changed or disappeared");
        let new_hashes = actual_hashes.difference(&frozen_hash_lines).copied().collect::<Vec<_>>().join("\n");
        let new_hashes = format!("{new_hashes}{}", if new_hashes.is_empty() { "" } else { "\n" });
        if std::env::var("UPDATE_GOLDEN").as_deref() == Ok("1") {
            std::fs::write(fixture_dir.join("migrations-0.9.5-additions.sha256"), &new_hashes).unwrap();
        }
        let reviewed_hashes = std::fs::read_to_string(fixture_dir.join("migrations-0.9.5-additions.sha256")).unwrap();
        assert_eq!(new_hashes, reviewed_hashes);
    }
}

#[cfg(test)]
mod backup_folder_path_tests {
    use super::ios_backup_path::{backup_folder_kind, backup_parent, is_document_location};
    use std::path::Path;

    #[test]
    fn accepts_only_known_folder_bookmarks() {
        assert_eq!(backup_folder_kind("auto"), Ok(0));
        assert_eq!(backup_folder_kind("import"), Ok(1));
        assert!(backup_folder_kind("other").is_err());
    }

    #[test]
    fn normalizes_child_backup_locations() {
        assert_eq!(backup_parent(Path::new("/cloud/track3-backup")), Some(Path::new("/cloud").to_path_buf()));
        assert_eq!(backup_parent(Path::new("/cloud/track3-backup/client-a")), Some(Path::new("/cloud").to_path_buf()));
        assert_eq!(backup_parent(Path::new("/cloud/other")), None);
    }

    #[test]
    fn documents_location_accepts_children_but_not_a_sibling() {
        let root = std::env::temp_dir().join(format!("track3-doc-path-{}", std::process::id()));
        let documents = root.join("Documents");
        std::fs::create_dir_all(documents.join("backups")).unwrap();
        std::fs::create_dir_all(root.join("Other")).unwrap();
        assert!(is_document_location(&documents, &documents));
        assert!(is_document_location(&documents.join("backups"), &documents));
        assert!(!is_document_location(&root.join("Other"), &documents));
        std::fs::remove_dir_all(root).unwrap();
    }
}
