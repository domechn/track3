use super::{migration::run_migrations, sync_persistence::import_sync_snapshot};
use sqlx::{Connection, SqliteConnection};
use std::path::PathBuf;

async fn table_rows(db: &mut SqliteConnection, table: &str) -> Vec<String> {
    let columns: Vec<String> = sqlx::query_scalar("SELECT name FROM pragma_table_info(?)")
        .bind(table).fetch_all(&mut *db).await.unwrap();
    let fields = columns.iter()
        .map(|column| format!("quote(\"{}\")", column.replace('"', "\"\"")))
        .collect::<Vec<_>>().join(",");
    let sql = format!("SELECT json_array({fields}) FROM \"{}\"", table.replace('"', "\"\""));
    let mut rows: Vec<String> = sqlx::query_scalar(&sql).fetch_all(&mut *db).await.unwrap();
    rows.sort();
    rows
}

#[test]
fn released_094_opens_new_database_after_version_reset_without_dropping_data() {
    let directory = PathBuf::from(std::env::var("TRACK3_COMPAT_FORWARD").unwrap());
    let db_path = directory.join("migrated.db");
    let resource_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    let runtime = tokio::runtime::Runtime::new().unwrap();
    runtime.block_on(async {
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display())).await.unwrap();
        let version: String = sqlx::query_scalar("SELECT data FROM configuration WHERE id=999").fetch_one(&mut db).await.unwrap();
        assert_eq!(version, "0.9.5");
        sqlx::query("UPDATE configuration SET data='0.9.4' WHERE id=999").execute(&mut db).await.unwrap();
        let schema: Vec<(String, String, Option<String>)> =
            sqlx::query_as("SELECT type, name, sql FROM sqlite_master ORDER BY type,name").fetch_all(&mut db).await.unwrap();
        let tables: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetch_all(&mut db).await.unwrap();
        let mut contents = Vec::new();
        for table in &tables {
            contents.push(table_rows(&mut db, table).await);
        }
        db.close().await.unwrap();

        run_migrations(&db_path, &resource_dir, "0.9.4").await.unwrap();
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display())).await.unwrap();
        let after: Vec<(String, String, Option<String>)> =
            sqlx::query_as("SELECT type, name, sql FROM sqlite_master ORDER BY type,name").fetch_all(&mut db).await.unwrap();
        assert_eq!(after, schema, "0.9.4 changed the new database schema");
        for (table, before) in tables.iter().zip(contents) {
            assert_eq!(table_rows(&mut db, table).await, before, "0.9.4 changed rows in {table}");
        }
        let assets: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets_v2 WHERE uuid='db-compat'").fetch_one(&mut db).await.unwrap();
        let transactions: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM transactions WHERE uuid='db-compat'").fetch_one(&mut db).await.unwrap();
        assert_eq!((assets, transactions), (1, 1));
        let edit_rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM snapshot_edit_log WHERE snapshot_uuid='db-compat'")
            .fetch_one(&mut db).await.unwrap();
        assert_eq!(edit_rows, 1);
        db.close().await.unwrap();

        let snapshot = serde_json::from_slice(&std::fs::read(directory.join("sync-snapshot.json")).unwrap()).unwrap();
        assert!(import_sync_snapshot(&db_path, snapshot).await.unwrap(), "0.9.4 Rust importer rejected optional snapshot data");
        let mut db = SqliteConnection::connect(&format!("sqlite://{}", db_path.display())).await.unwrap();
        let imported: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets_v2 WHERE uuid='10000000-0000-4000-8000-000000000001'").fetch_one(&mut db).await.unwrap();
        assert_eq!(imported, 1);
        db.close().await.unwrap();
    });
}
