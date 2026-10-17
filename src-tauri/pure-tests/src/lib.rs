#[path = "../../src/binance.rs"]
pub mod binance;
#[path = "../../src/ent.rs"]
pub mod ent;
#[path = "../../src/info.rs"]
pub mod info;
#[path = "../../src/migration.rs"]
pub mod migration;
#[path = "../../src/sync_persistence.rs"]
pub mod sync_persistence;
#[path = "../../src/types.rs"]
pub mod types;

#[cfg(test)]
mod sync_tests {
    use super::sync_persistence::{
        delete_sync_snapshot, import_sync_snapshot, replace_sync_snapshot,
    };
    use sqlx::{Connection, Executor, SqliteConnection};

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
    use sqlx::{Connection, Executor, SqliteConnection};
    use std::path::PathBuf;

    const NEW_TABLE_SCRIPTS: [(&str, &str, &str); 4] = [
        ("rebalance_profiles_up.sql", include_str!("../../migrations/init/rebalance_profiles_up.sql"), include_str!("../../migrations/v08t09/rebalance_profiles_up.sql")),
        ("alerts_up.sql", include_str!("../../migrations/init/alerts_up.sql"), include_str!("../../migrations/v08t09/alerts_up.sql")),
        ("history_snapshots_up.sql", include_str!("../../migrations/init/history_snapshots_up.sql"), include_str!("../../migrations/v08t09/history_snapshots_up.sql")),
        ("sync_state_up.sql", include_str!("../../migrations/init/sync_state_up.sql"), include_str!("../../migrations/v08t09/sync_state_up.sql")),
    ];

    #[test]
    fn init_and_v08t09_copies_of_the_new_tables_are_identical_and_registered() {
        let database_path_rs = include_str!("../../src/database_path.rs");
        for (name, init, versioned) in NEW_TABLE_SCRIPTS {
            assert_eq!(init, versioned, "{name} differs between init and v08t09");
            assert!(database_path_rs.contains(&format!("\"{name}\"")), "{name} missing from INITIALIZATION_SCRIPTS");
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
            for sql in [
                include_str!("../../migrations/init/configuration_up.sql"),
                include_str!("../../migrations/init/assets_v2_up.sql"),
                include_str!("../../migrations/init/currency_rates_up.sql"),
                include_str!("../../migrations/init/asset_prices_up.sql"),
                include_str!("../../migrations/init/transactions_up.sql"),
                include_str!("../../migrations/init/chat_sessions_up.sql"),
                include_str!("../../migrations/init/cloud_sync_up.sql"),
            ] {
                db.execute(sql).await.unwrap();
            }
            for (_, init, _) in NEW_TABLE_SCRIPTS {
                db.execute(init).await.unwrap();
            }
            db.close().await.unwrap();
            run_migrations(&db_path, &resource_dir, "0.9.0").await.unwrap();
            run_migrations(&db_path, &resource_dir, "0.9.0").await.unwrap();
            let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display())).await.unwrap();
            for table in ["rebalance_profiles", "alert_rules", "alert_history", "history_snapshots", "sync_state", "sync_applied_objects", "sync_snapshot_revisions"] {
                let found: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?")
                    .bind(table).fetch_one(&mut db).await.unwrap();
                assert_eq!(found, 1, "{table} missing after a fresh install");
            }
            db.close().await.unwrap();
        });
        std::fs::remove_dir_all(root).unwrap();
    }
}
