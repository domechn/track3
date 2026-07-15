use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS};
use sqlx::{
    sqlite::SqliteConnectOptions, Connection, Error as SqlxError, Executor, SqliteConnection,
};
use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};

const DATABASE_NAME: &str = "track3.db";
const CONFIGURATION_TABLE_NAME: &str = "configuration";
const VERSION_CONFIGURATION_ID: i32 = 999;
const SQLITE_CORRUPT_CODE: i32 = 11;
const SQLITE_NOTADB_CODE: i32 = 26;
// Tauri maps the URL suffix as a PathBuf before SQLx percent-decodes it.
const SQLITE_PATH_ENCODE_SET: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'<')
    .add(b'>')
    .add(b'?')
    .add(b'`')
    .add(b'{')
    .add(b'}');
const INITIALIZATION_SCRIPTS: [&str; 7] = [
    "configuration_up.sql",
    "assets_v2_up.sql",
    "currency_rates_up.sql",
    "asset_prices_up.sql",
    "transactions_up.sql",
    "chat_sessions_up.sql",
    "cloud_sync_up.sql",
];

#[derive(Clone, Debug)]
pub struct DatabasePath(pub PathBuf);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum DatabaseState {
    Missing,
    EmptyOrUninitialized,
    Invalid,
    Valid,
}

fn is_invalid_sqlite_code(code: i32) -> bool {
    matches!(code & 0xff, SQLITE_CORRUPT_CODE | SQLITE_NOTADB_CODE)
}

fn is_invalid_database_error(error: &SqlxError) -> bool {
    error
        .as_database_error()
        .and_then(|error| error.code())
        .and_then(|code| code.parse::<i32>().ok())
        .is_some_and(is_invalid_sqlite_code)
}

async fn classify_database(path: &Path) -> Result<DatabaseState, String> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(DatabaseState::Missing),
        Err(error) => {
            return Err(format!(
                "failed to inspect database candidate {}: {error}",
                path.display()
            ));
        }
    };
    if !metadata.is_file() {
        return Err(format!(
            "database candidate is not a regular file: {}",
            path.display()
        ));
    }

    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(false)
        .read_only(true);
    let mut connection = match SqliteConnection::connect_with(&options).await {
        Ok(connection) => connection,
        Err(error) if is_invalid_database_error(&error) => return Ok(DatabaseState::Invalid),
        Err(error) => {
            return Err(format!(
                "failed to open database candidate {}: {error}",
                path.display()
            ));
        }
    };
    let configuration_count = match sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master
         WHERE type = 'table' AND name = ?",
    )
    .bind(CONFIGURATION_TABLE_NAME)
    .fetch_one(&mut connection)
    .await
    {
        Ok(count) => count,
        Err(error) if is_invalid_database_error(&error) => return Ok(DatabaseState::Invalid),
        Err(error) => {
            return Err(format!(
                "failed to inspect database candidate {}: {error}",
                path.display()
            ));
        }
    };
    connection.close().await.map_err(|error| {
        format!(
            "failed to close database candidate {}: {error}",
            path.display()
        )
    })?;

    if configuration_count > 0 {
        Ok(DatabaseState::Valid)
    } else {
        Ok(DatabaseState::EmptyOrUninitialized)
    }
}

pub async fn resolve_database_path(
    app_data_dir: &Path,
    app_config_dir: &Path,
) -> Result<PathBuf, String> {
    let data_path = app_data_dir.join(DATABASE_NAME);
    let config_path = app_config_dir.join(DATABASE_NAME);
    let data_state = classify_database(&data_path).await?;
    let config_state = classify_database(&config_path).await?;

    match (data_state, config_state) {
        (DatabaseState::Valid, DatabaseState::Valid) => {
            let canonical_data = fs::canonicalize(&data_path).map_err(|error| {
                format!(
                    "failed to canonicalize database {}: {error}",
                    data_path.display()
                )
            })?;
            let canonical_config = fs::canonicalize(&config_path).map_err(|error| {
                format!(
                    "failed to canonicalize database {}: {error}",
                    config_path.display()
                )
            })?;

            if canonical_data == canonical_config {
                Ok(data_path)
            } else {
                Err(format!(
                    "multiple valid Track3 databases found at {} and {}; \
                     refusing to select one automatically",
                    data_path.display(),
                    config_path.display()
                ))
            }
        }
        (DatabaseState::Valid, _) => Ok(data_path),
        (_, DatabaseState::Valid) => Ok(config_path),
        (_, _) => Ok(data_path),
    }
}

pub async fn initialize_database(
    database_path: &Path,
    app_version: &str,
    resource_dir: &Path,
) -> Result<(), String> {
    let parent = database_path.parent().ok_or_else(|| {
        format!(
            "database path has no parent directory: {}",
            database_path.display()
        )
    })?;
    fs::create_dir_all(parent).map_err(|error| {
        format!(
            "failed to create database directory {}: {error}",
            parent.display()
        )
    })?;

    let mut scripts = Vec::with_capacity(INITIALIZATION_SCRIPTS.len());
    for name in INITIALIZATION_SCRIPTS {
        let path = resource_dir.join("migrations/init").join(name);
        let sql = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        scripts.push((path, sql));
    }

    let options = SqliteConnectOptions::new()
        .filename(database_path)
        .create_if_missing(true);
    let mut connection = SqliteConnection::connect_with(&options)
        .await
        .map_err(|error| {
            format!(
                "failed to open database {}: {error}",
                database_path.display()
            )
        })?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("failed to begin database initialization transaction: {error}"))?;

    for (path, sql) in scripts {
        transaction.execute(sql.as_str()).await.map_err(|error| {
            format!(
                "failed to execute initialization script {}: {error}",
                path.display()
            )
        })?;
    }

    sqlx::query(
        "INSERT INTO configuration (id, data) VALUES (?, ?)
         ON CONFLICT(id) DO NOTHING",
    )
    .bind(VERSION_CONFIGURATION_ID)
    .bind(app_version)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("failed to record database version: {error}"))?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("failed to commit database initialization: {error}"))?;
    connection.close().await.map_err(|error| {
        format!(
            "failed to close database {}: {error}",
            database_path.display()
        )
    })?;
    Ok(())
}

pub async fn initialize_database_if_needed(
    database_path: &Path,
    app_version: &str,
    resource_dir: &Path,
) -> Result<(), String> {
    match classify_database(database_path).await? {
        DatabaseState::Valid => Ok(()),
        DatabaseState::Missing | DatabaseState::EmptyOrUninitialized => {
            initialize_database(database_path, app_version, resource_dir).await
        }
        DatabaseState::Invalid => Err(format!(
            "database is not a valid SQLite database: {}",
            database_path.display()
        )),
    }
}

pub fn sqlite_url(path: &Path) -> Result<String, String> {
    let path = path
        .to_str()
        .ok_or_else(|| format!("database path is not valid UTF-8: {}", path.display()))?;
    Ok(format!(
        "sqlite:{}",
        utf8_percent_encode(path, SQLITE_PATH_ENCODE_SET)
    ))
}

#[cfg(test)]
mod tests {
    use super::{
        initialize_database, initialize_database_if_needed, is_invalid_sqlite_code,
        resolve_database_path, sqlite_url, DATABASE_NAME,
    };
    use sqlx::{sqlite::SqliteConnectOptions, Connection, Executor, SqliteConnection};
    use std::{
        fs,
        path::{Path, PathBuf},
    };
    use tokio::runtime::Runtime;
    use uuid::Uuid;

    #[derive(Clone, Copy)]
    enum DatabaseFixture {
        Missing,
        Empty,
        Valid,
    }

    #[derive(Clone, Copy)]
    enum ExpectedSelection {
        Data,
        Config,
        Conflict,
    }

    struct ResolverCase {
        name: &'static str,
        data_fixture: DatabaseFixture,
        config_fixture: DatabaseFixture,
        expected: ExpectedSelection,
    }

    #[test]
    fn classifies_malformed_sqlite_codes_without_suppressing_operational_errors() {
        for (code, expected_invalid) in [
            (11, true),   // SQLITE_CORRUPT
            (267, true),  // SQLITE_CORRUPT_VTAB
            (26, true),   // SQLITE_NOTADB
            (5, false),   // SQLITE_BUSY
            (6, false),   // SQLITE_LOCKED
            (10, false),  // SQLITE_IOERR
            (266, false), // SQLITE_IOERR_READ
            (14, false),  // SQLITE_CANTOPEN
        ] {
            assert_eq!(
                is_invalid_sqlite_code(code),
                expected_invalid,
                "SQLite code {code}"
            );
        }
    }

    fn make_temp_dir(prefix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("track3-{prefix}-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    async fn create_fixture(path: &Path, fixture: DatabaseFixture) {
        match fixture {
            DatabaseFixture::Missing => {}
            DatabaseFixture::Empty => {
                fs::File::create(path).unwrap();
            }
            DatabaseFixture::Valid => {
                let options = SqliteConnectOptions::new()
                    .filename(path)
                    .create_if_missing(true);
                let mut connection = SqliteConnection::connect_with(&options).await.unwrap();
                connection
                    .execute(
                        "CREATE TABLE configuration (
                            id INTEGER PRIMARY KEY,
                            data TEXT NOT NULL
                        )",
                    )
                    .await
                    .unwrap();
                connection.close().await.unwrap();
            }
        }
    }

    #[test]
    fn resolves_database_candidates_without_modifying_them() {
        let cases = [
            ResolverCase {
                name: "new-install",
                data_fixture: DatabaseFixture::Missing,
                config_fixture: DatabaseFixture::Missing,
                expected: ExpectedSelection::Data,
            },
            ResolverCase {
                name: "legacy-config-only",
                data_fixture: DatabaseFixture::Missing,
                config_fixture: DatabaseFixture::Valid,
                expected: ExpectedSelection::Config,
            },
            ResolverCase {
                name: "valid-data-empty-config",
                data_fixture: DatabaseFixture::Valid,
                config_fixture: DatabaseFixture::Empty,
                expected: ExpectedSelection::Data,
            },
            ResolverCase {
                name: "different-valid-databases",
                data_fixture: DatabaseFixture::Valid,
                config_fixture: DatabaseFixture::Valid,
                expected: ExpectedSelection::Conflict,
            },
        ];

        let runtime = Runtime::new().unwrap();

        for case in cases {
            let root = make_temp_dir(case.name);
            let data_dir = root.join("data");
            let config_dir = root.join("config");
            fs::create_dir_all(&data_dir).unwrap();
            fs::create_dir_all(&config_dir).unwrap();

            let data_path = data_dir.join(DATABASE_NAME);
            let config_path = config_dir.join(DATABASE_NAME);
            runtime.block_on(create_fixture(&data_path, case.data_fixture));
            runtime.block_on(create_fixture(&config_path, case.config_fixture));

            let data_before = fs::read(&data_path).ok();
            let config_before = fs::read(&config_path).ok();
            let result = runtime.block_on(resolve_database_path(&data_dir, &config_dir));

            match case.expected {
                ExpectedSelection::Data => {
                    assert_eq!(result.unwrap(), data_path, "case: {}", case.name);
                }
                ExpectedSelection::Config => {
                    assert_eq!(result.unwrap(), config_path, "case: {}", case.name);
                }
                ExpectedSelection::Conflict => {
                    let error = result.unwrap_err();
                    assert!(error.contains(&data_path.display().to_string()));
                    assert!(error.contains(&config_path.display().to_string()));
                }
            }

            assert_eq!(
                fs::read(&data_path).ok(),
                data_before,
                "data database changed in case: {}",
                case.name
            );
            assert_eq!(
                fs::read(&config_path).ok(),
                config_before,
                "config database changed in case: {}",
                case.name
            );
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn resolves_distinct_paths_that_canonicalize_to_the_same_database() {
        let root = make_temp_dir("same-file");
        let shared_dir = root.join("shared");
        fs::create_dir_all(&shared_dir).unwrap();
        let database_path = shared_dir.join(DATABASE_NAME);
        let alias_dir = shared_dir.join("..").join("shared");
        let alias_path = alias_dir.join(DATABASE_NAME);
        assert_ne!(database_path, alias_path);
        assert_ne!(
            alias_path,
            fs::canonicalize(&shared_dir).unwrap().join(DATABASE_NAME)
        );

        let runtime = Runtime::new().unwrap();
        runtime.block_on(create_fixture(&database_path, DatabaseFixture::Valid));
        let bytes_before = fs::read(&database_path).unwrap();

        let selected = runtime
            .block_on(resolve_database_path(&alias_dir, &shared_dir))
            .unwrap();

        assert_eq!(selected, alias_path);
        assert_eq!(fs::read(&database_path).unwrap(), bytes_before);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn selects_valid_database_over_empty_or_malformed_candidates() {
        let runtime = Runtime::new().unwrap();

        let empty_root = make_temp_dir("empty-candidate");
        let empty_data_dir = empty_root.join("data");
        let empty_config_dir = empty_root.join("config");
        fs::create_dir_all(&empty_data_dir).unwrap();
        fs::create_dir_all(&empty_config_dir).unwrap();
        let empty_path = empty_data_dir.join(DATABASE_NAME);
        fs::File::create(&empty_path).unwrap();

        let selected = runtime
            .block_on(resolve_database_path(&empty_data_dir, &empty_config_dir))
            .unwrap();
        assert_eq!(selected, empty_path);
        assert_eq!(fs::read(&empty_path).unwrap(), Vec::<u8>::new());
        fs::remove_dir_all(empty_root).unwrap();

        let corrupt_root = make_temp_dir("corrupt-candidate");
        let corrupt_data_dir = corrupt_root.join("data");
        let valid_config_dir = corrupt_root.join("config");
        fs::create_dir_all(&corrupt_data_dir).unwrap();
        fs::create_dir_all(&valid_config_dir).unwrap();
        let corrupt_path = corrupt_data_dir.join(DATABASE_NAME);
        let valid_path = valid_config_dir.join(DATABASE_NAME);
        fs::write(&corrupt_path, b"not a sqlite database").unwrap();
        runtime.block_on(create_fixture(&valid_path, DatabaseFixture::Valid));
        let corrupt_before = fs::read(&corrupt_path).unwrap();
        let valid_before = fs::read(&valid_path).unwrap();

        let selected = runtime
            .block_on(resolve_database_path(&corrupt_data_dir, &valid_config_dir))
            .unwrap();

        assert_eq!(selected, valid_path);
        assert_eq!(fs::read(&corrupt_path).unwrap(), corrupt_before);
        assert_eq!(fs::read(&valid_path).unwrap(), valid_before);
        fs::remove_dir_all(corrupt_root).unwrap();
    }

    enum InitializationSetup {
        MissingNestedDirectory,
        ParentIsFile,
    }

    struct InitializationCase {
        name: &'static str,
        setup: InitializationSetup,
        succeeds: bool,
    }

    #[test]
    fn initializes_database_or_returns_a_parent_path_error() {
        let cases = [
            InitializationCase {
                name: "missing-nested-directory",
                setup: InitializationSetup::MissingNestedDirectory,
                succeeds: true,
            },
            InitializationCase {
                name: "parent-is-file",
                setup: InitializationSetup::ParentIsFile,
                succeeds: false,
            },
        ];
        let runtime = Runtime::new().unwrap();
        let resource_dir = Path::new(env!("CARGO_MANIFEST_DIR"));

        for case in cases {
            let root = make_temp_dir(case.name);
            let database_path = match case.setup {
                InitializationSetup::MissingNestedDirectory => {
                    root.join("missing/nested").join(DATABASE_NAME)
                }
                InitializationSetup::ParentIsFile => {
                    let parent = root.join("not-a-directory");
                    fs::write(&parent, b"file").unwrap();
                    parent.join(DATABASE_NAME)
                }
            };

            let result =
                runtime.block_on(initialize_database(&database_path, "9.8.7", resource_dir));

            if case.succeeds {
                result.unwrap();
                runtime.block_on(async {
                    let options = SqliteConnectOptions::new().filename(&database_path);
                    let mut connection = SqliteConnection::connect_with(&options).await.unwrap();
                    let table_count: i64 = sqlx::query_scalar(
                        "SELECT COUNT(*) FROM sqlite_master
                         WHERE type = 'table'
                         AND name IN (
                            'configuration',
                            'assets_v2',
                            'currency_rates',
                            'asset_prices',
                            'transactions',
                            'chat_sessions'
                         )",
                    )
                    .fetch_one(&mut connection)
                    .await
                    .unwrap();
                    assert_eq!(table_count, 6);

                    connection
                        .execute("DROP TABLE chat_sessions")
                        .await
                        .unwrap();
                    connection
                        .execute(
                            "UPDATE configuration
                             SET data = '1.2.3'
                             WHERE id = 999",
                        )
                        .await
                        .unwrap();
                    connection.close().await.unwrap();
                });

                runtime
                    .block_on(initialize_database(&database_path, "9.9.0", resource_dir))
                    .unwrap();

                runtime.block_on(async {
                    let options = SqliteConnectOptions::new().filename(&database_path);
                    let mut connection = SqliteConnection::connect_with(&options).await.unwrap();
                    let version: String =
                        sqlx::query_scalar("SELECT data FROM configuration WHERE id = 999")
                            .fetch_one(&mut connection)
                            .await
                            .unwrap();
                    assert_eq!(version, "1.2.3");
                    let chat_sessions_exists: i64 = sqlx::query_scalar(
                        "SELECT COUNT(*) FROM sqlite_master
                         WHERE type = 'table' AND name = 'chat_sessions'",
                    )
                    .fetch_one(&mut connection)
                    .await
                    .unwrap();
                    assert_eq!(chat_sessions_exists, 1);
                    connection
                        .execute("DELETE FROM configuration WHERE id = 999")
                        .await
                        .unwrap();
                    connection.close().await.unwrap();
                });

                runtime
                    .block_on(initialize_database(&database_path, "9.9.0", resource_dir))
                    .unwrap();

                runtime.block_on(async {
                    let options = SqliteConnectOptions::new().filename(&database_path);
                    let mut connection = SqliteConnection::connect_with(&options).await.unwrap();
                    let version: String =
                        sqlx::query_scalar("SELECT data FROM configuration WHERE id = 999")
                            .fetch_one(&mut connection)
                            .await
                            .unwrap();
                    assert_eq!(version, "9.9.0");
                    connection.close().await.unwrap();
                });
            } else {
                assert!(result.is_err(), "case should return Err: {}", case.name);
            }

            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn initialization_rolls_back_all_scripts_when_one_fails() {
        let root = make_temp_dir("initialization-rollback");
        let resource_dir = root.join("resources");
        let init_dir = resource_dir.join("migrations/init");
        let database_path = root.join("data").join(DATABASE_NAME);
        fs::create_dir_all(&init_dir).unwrap();

        for (name, sql) in [
            (
                "configuration_up.sql",
                "CREATE TABLE configuration (
                    id INTEGER PRIMARY KEY,
                    data TEXT NOT NULL
                );",
            ),
            (
                "assets_v2_up.sql",
                "CREATE TABLE initialization_marker (id INTEGER PRIMARY KEY);",
            ),
            (
                "currency_rates_up.sql",
                "CREATE TABLE rolled_back_marker (id INTEGER PRIMARY KEY);
                 THIS IS NOT VALID SQL;",
            ),
            ("asset_prices_up.sql", "SELECT 1;"),
            ("transactions_up.sql", "SELECT 1;"),
            ("chat_sessions_up.sql", "SELECT 1;"),
            ("cloud_sync_up.sql", "SELECT 1;"),
        ] {
            fs::write(init_dir.join(name), sql).unwrap();
        }

        let runtime = Runtime::new().unwrap();
        let error = runtime
            .block_on(initialize_database(&database_path, "9.9.0", &resource_dir))
            .unwrap_err();
        assert!(error.contains("currency_rates_up.sql"));

        runtime.block_on(async {
            let options = SqliteConnectOptions::new().filename(&database_path);
            let mut connection = SqliteConnection::connect_with(&options).await.unwrap();
            let table_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'table'
                 AND name IN (
                    'configuration',
                    'initialization_marker',
                    'rolled_back_marker'
                 )",
            )
            .fetch_one(&mut connection)
            .await
            .unwrap();
            assert_eq!(table_count, 0);
            connection.close().await.unwrap();
        });

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn startup_initialization_leaves_a_valid_legacy_database_for_migrations() {
        let root = make_temp_dir("legacy-initialization");
        let database_path = root.join(DATABASE_NAME);
        let runtime = Runtime::new().unwrap();
        runtime.block_on(async {
            let options = SqliteConnectOptions::new()
                .filename(&database_path)
                .create_if_missing(true);
            let mut connection = SqliteConnection::connect_with(&options).await.unwrap();
            connection
                .execute(
                    "CREATE TABLE configuration (
                        id INTEGER PRIMARY KEY,
                        data TEXT NOT NULL
                    );
                    INSERT INTO configuration (id, data) VALUES (999, '0.6.0');
                    CREATE TABLE assets_v2 (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        uuid TEXT NOT NULL,
                        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        wallet TEXT,
                        symbol TEXT NOT NULL,
                        amount REAL NOT NULL,
                        value REAL NOT NULL,
                        price REAL NOT NULL
                    );",
                )
                .await
                .unwrap();
            connection.close().await.unwrap();
        });
        let bytes_before = fs::read(&database_path).unwrap();

        runtime
            .block_on(initialize_database_if_needed(
                &database_path,
                "9.9.0",
                Path::new(env!("CARGO_MANIFEST_DIR")),
            ))
            .unwrap();

        assert_eq!(fs::read(&database_path).unwrap(), bytes_before);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn sqlite_url_round_trips_reserved_path_characters() {
        let database_path = std::env::temp_dir().join("track3 %2F?#.db");
        let url = sqlite_url(&database_path).unwrap();
        assert!(url.contains("%25"));
        assert!(url.contains("%3F"));
        assert!(url.contains("%23"));
        assert!(Path::new(url.strip_prefix("sqlite:").unwrap()).is_absolute());
        let options: SqliteConnectOptions = url.parse().unwrap();
        assert_eq!(options.get_filename(), database_path);
    }

    #[cfg(not(windows))]
    #[test]
    fn sqlite_url_connects_to_reserved_character_path() {
        let root = make_temp_dir("reserved-url");
        let database_path = root.join("track3 %2F?#.db");
        let runtime = Runtime::new().unwrap();
        runtime.block_on(create_fixture(&database_path, DatabaseFixture::Valid));

        let url = sqlite_url(&database_path).unwrap();
        runtime.block_on(async {
            let mut connection = SqliteConnection::connect(&url).await.unwrap();
            let configuration_exists: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'table' AND name = 'configuration'",
            )
            .fetch_one(&mut connection)
            .await
            .unwrap();
            assert_eq!(configuration_exists, 1);
            connection.close().await.unwrap();
        });
        fs::remove_dir_all(root).unwrap();
    }
}
