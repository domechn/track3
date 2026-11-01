use crate::{
    migration::run_migrations,
    refresh_persistence::persist_refresh,
    sync_persistence::{delete_sync_snapshot, import_sync_snapshot, replace_sync_snapshot},
};
use serde_json::json;
use sqlx::{Connection, Executor, SqliteConnection};

const ID: &str = "10000000-0000-4000-8000-000000000001";
const AT: &str = "2024-04-16T13:00:00.000Z";

fn partial() -> serde_json::Value {
    json!({
        "sourcesTotal": 2,
        "missing": [{"wallet": "ddf7fe606e048ac89f8a8c62bf23c4be", "kind": "exchange",
            "provider": "OKX", "category": "network", "lastSuccessAt": "2024-04-15T12:00:00.000Z"}],
        "fill": "last_known",
        "createdAt": AT
    })
}

async fn database() -> std::path::PathBuf {
    let path = std::env::temp_dir().join(format!("track3-partial-{}.db", uuid::Uuid::new_v4()));
    let mut db = SqliteConnection::connect(&format!("sqlite://{}?mode=rwc", path.display()))
        .await
        .unwrap();
    for sql in [
        include_str!("../../migrations/init/configuration_up.sql"),
        include_str!("../../migrations/init/assets_v2_up.sql"),
        include_str!("../../migrations/init/asset_prices_up.sql"),
        include_str!("../../migrations/init/transactions_up.sql"),
        include_str!("../../migrations/init/sync_state_up.sql"),
        include_str!("../../migrations/init/snapshot_edit_log_up.sql"),
        include_str!("../../migrations/init/snapshot_partial_up.sql"),
    ] {
        db.execute(sql).await.unwrap();
    }
    db.close().await.unwrap();
    path
}

#[test]
fn partial_table_migration_is_idempotent() {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    runtime.block_on(async {
        let path = database().await;
        let resources = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
        db.execute("DROP TABLE snapshot_partial").await.unwrap();
        db.close().await.unwrap();
        run_migrations(&path, &resources, "0.9.5").await.unwrap();
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
        db.execute("INSERT INTO snapshot_partial (uuid, sources_total, missing, fill, created_at) VALUES ('old', 1, '[{\"wallet\":\"ddf7fe606e048ac89f8a8c62bf23c4be\",\"kind\":\"exchange\",\"provider\":\"OKX\",\"category\":\"network\"}]', 'last_known', '2024-04-16T13:00:00.000Z')").await.unwrap();
        let schema: String = sqlx::query_scalar("SELECT sql FROM sqlite_master WHERE name='snapshot_partial'")
            .fetch_one(&mut db).await.unwrap();
        db.close().await.unwrap();
        run_migrations(&path, &resources, "0.9.5").await.unwrap();
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
        let after: String = sqlx::query_scalar("SELECT sql FROM sqlite_master WHERE name='snapshot_partial'")
            .fetch_one(&mut db).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM snapshot_partial").fetch_one(&mut db).await.unwrap();
        assert_eq!((after, count), (schema, 1));
        db.close().await.unwrap();
        std::fs::remove_file(path).unwrap();
    });
}

#[test]
fn existing_094_database_gets_partial_table_at_current_app_version() {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    runtime.block_on(async {
        let path = database().await;
        let resources = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display()))
            .await
            .unwrap();
        db.execute("DROP TABLE snapshot_partial").await.unwrap();
        db.close().await.unwrap();
        run_migrations(&path, &resources, "0.9.4").await.unwrap();
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display()))
            .await
            .unwrap();
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='snapshot_partial'",
        )
        .fetch_one(&mut db)
        .await
        .unwrap();
        assert_eq!(count, 1);
        db.close().await.unwrap();
        std::fs::remove_file(path).unwrap();
    });
}

#[test]
fn refresh_marker_is_atomic_and_retry_keeps_original() {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    runtime.block_on(async {
        let path = database().await;
        let assets = vec![crate::types::RefreshAssetInput {
            asset_type: "crypto".into(), wallet: "ddf7fe606e048ac89f8a8c62bf23c4be".into(),
            symbol: "BTC".into(), amount: 1.0, value: 2.0, price: 2.0,
        }];
        let txns = Vec::new();
        let mut invalid = partial();
        invalid["missing"][0]["wallet"] = json!("raw-api-key");
        assert!(persist_refresh(&path, ID, AT, &assets, &txns, Some(invalid)).await.is_err());
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM refresh_operations").fetch_one(&mut db).await.unwrap_or(0);
        assert_eq!(count, 0);
        db.execute("CREATE TRIGGER fail_partial BEFORE INSERT ON snapshot_partial BEGIN SELECT RAISE(ABORT, 'injected'); END").await.unwrap();
        db.close().await.unwrap();
        assert!(persist_refresh(&path, ID, AT, &assets, &txns, Some(partial())).await.is_err());
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets_v2 WHERE uuid = ?")
            .bind(ID).fetch_one(&mut db).await.unwrap();
        assert_eq!(count, 0);
        db.execute("DROP TRIGGER fail_partial").await.unwrap();
        db.close().await.unwrap();
        persist_refresh(&path, ID, AT, &assets, &txns, Some(partial())).await.unwrap();
        persist_refresh(&path, ID, AT, &assets, &txns, None).await.unwrap();
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM snapshot_partial WHERE uuid = ?")
            .bind(ID).fetch_one(&mut db).await.unwrap();
        assert_eq!(count, 1);
        db.close().await.unwrap();
        std::fs::remove_file(path).unwrap();
    });
}

#[test]
fn sync_import_carries_marker_and_legacy_replace_preserves_it() {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    runtime.block_on(async {
        let path = database().await;
        let snapshot = json!({"uuid": ID, "assets": [], "prices": [], "transactions": [], "partial": partial()});
        assert!(import_sync_snapshot(&path, snapshot.clone()).await.unwrap());
        let mut legacy = snapshot;
        legacy.as_object_mut().unwrap().remove("partial");
        replace_sync_snapshot(&path, legacy).await.unwrap();
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM snapshot_partial WHERE uuid = ?")
            .bind(ID).fetch_one(&mut db).await.unwrap();
        assert_eq!(count, 1);
        db.close().await.unwrap();
        delete_sync_snapshot(&path, ID).await.unwrap();
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display())).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM snapshot_partial").fetch_one(&mut db).await.unwrap();
        assert_eq!(count, 0);
        db.close().await.unwrap();
        std::fs::remove_file(path).unwrap();
    });
}

#[test]
fn sync_import_keeps_assets_when_optional_marker_is_from_a_newer_client() {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    runtime.block_on(async {
        let path = database().await;
        let mut marker = partial();
        marker["missing"][0]["category"] = json!("newCategory");
        let snapshot = json!({
            "uuid": ID,
            "assets": [{"id": 1, "uuid": ID, "createdAt": AT,
                "wallet": "ddf7fe606e048ac89f8a8c62bf23c4be", "asset_type": "crypto",
                "symbol": "BTC", "amount": 1, "value": 2, "price": 2}],
            "prices": [], "transactions": [], "partial": marker
        });
        assert!(import_sync_snapshot(&path, snapshot).await.unwrap());
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", path.display()))
            .await
            .unwrap();
        let asset_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets_v2 WHERE uuid = ?")
            .bind(ID)
            .fetch_one(&mut db)
            .await
            .unwrap();
        let marker_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM snapshot_partial WHERE uuid = ?")
                .bind(ID)
                .fetch_one(&mut db)
                .await
                .unwrap();
        assert_eq!((asset_count, marker_count), (1, 0));
        db.close().await.unwrap();
        std::fs::remove_file(path).unwrap();
    });
}
