use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    sync::{mpsc, Arc, Barrier},
    thread,
    time::Duration,
};

use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection};
use uuid::Uuid;

use crate::ent::Ent;

use super::{
    files::{
        cleanup_file_artifacts, replacement_strategy, sibling_with_suffix, windows_move_flags,
        write_random_restricted, ReplacementStrategy, BACKUP_SUFFIX,
    },
    journal::{JOURNAL_NAME, MAX_JOURNAL_BYTES},
    preflight, recover_pending_rotation, rotate_encryption_key, rotate_for_command_with_failpoint,
    rotate_with_failpoint, RotationCommandError, RotationFailpoint, RotationPhase,
    MAX_CIPHERTEXT_BYTES, RECOVERY_REQUIRED_MESSAGE,
};

const OLD_KEY: &str = "old-key-for-tests";
const NEW_KEY: &str = "new-key-for-tests";
const LEGACY_KEY: &str = "#t.3eis@hck,btr!a";
const FIRST_SESSION_FILE: &str = "00000000-0000-4000-8000-000000000001.json.ent";
const SECOND_SESSION_FILE: &str = "00000000-0000-4000-8000-000000000002.json.ent";

struct TestDirectory(PathBuf);

impl TestDirectory {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("track3-key-rotation-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

struct Fixture {
    _root: TestDirectory,
    database_path: PathBuf,
    app_data_dir: PathBuf,
    ent: Arc<Ent>,
    encrypted_rows: BTreeMap<i64, String>,
    session_plaintexts: BTreeMap<String, String>,
}

impl Fixture {
    async fn new() -> Self {
        let root = TestDirectory::new();
        let app_data_dir = root.0.join("app-data");
        let database_path = app_data_dir.join("track3.db");
        let sessions_dir = app_data_dir.join("ai/sessions");
        fs::create_dir_all(&sessions_dir).unwrap();

        let ent = Arc::new(Ent::new());
        ent.set_key(OLD_KEY.to_string()).unwrap();

        let encrypted_plaintexts = [
            (997, "license"),
            (994, "ai configuration"),
            (10, "wallet configuration"),
            (11, "exchange configuration"),
            (20, "stock configuration"),
        ];
        let encrypted_rows = encrypted_plaintexts
            .into_iter()
            .map(|(id, plaintext)| (id, ent.encrypt(plaintext.to_string()).unwrap()))
            .collect::<BTreeMap<_, _>>();

        let mut connection = connect(&database_path, true).await;
        sqlx::query(
            "CREATE TABLE configuration (
                    id INTEGER PRIMARY KEY,
                    data TEXT NOT NULL
                )",
        )
        .execute(&mut connection)
        .await
        .unwrap();
        for (id, ciphertext) in &encrypted_rows {
            sqlx::query("INSERT INTO configuration (id, data) VALUES (?, ?)")
                .bind(id)
                .bind(ciphertext)
                .execute(&mut connection)
                .await
                .unwrap();
        }
        sqlx::query("INSERT INTO configuration (id, data) VALUES (30, ?)")
            .bind("plain configuration")
            .execute(&mut connection)
            .await
            .unwrap();
        connection.close().await.unwrap();

        let session_plaintexts = [
            (
                FIRST_SESSION_FILE.to_string(),
                r#"{"version":1,"messages":[{"role":"user","content":"hello"}]}"#.to_string(),
            ),
            (
                SECOND_SESSION_FILE.to_string(),
                r#"{"version":1,"messages":[{"role":"assistant","blocks":[]}]}"#.to_string(),
            ),
        ]
        .into_iter()
        .collect::<BTreeMap<_, _>>();
        for (name, plaintext) in &session_plaintexts {
            fs::write(
                sessions_dir.join(name),
                ent.encrypt(plaintext.clone()).unwrap(),
            )
            .unwrap();
        }
        fs::write(app_data_dir.join(".ent-key"), OLD_KEY).unwrap();

        Self {
            _root: root,
            database_path,
            app_data_dir,
            ent,
            encrypted_rows,
            session_plaintexts,
        }
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

async fn configuration_rows(path: &Path) -> BTreeMap<i64, String> {
    let mut connection = connect(path, false).await;
    let rows = sqlx::query_as::<_, (i64, String)>("SELECT id, data FROM configuration ORDER BY id")
        .fetch_all(&mut connection)
        .await
        .unwrap();
    connection.close().await.unwrap();
    rows.into_iter().collect()
}

fn session_files(app_data_dir: &Path) -> BTreeMap<String, String> {
    let sessions_dir = app_data_dir.join("ai/sessions");
    let mut files = BTreeMap::new();
    for entry in fs::read_dir(sessions_dir).unwrap() {
        let entry = entry.unwrap();
        if entry.file_type().unwrap().is_file() {
            files.insert(
                entry.file_name().to_string_lossy().into_owned(),
                fs::read_to_string(entry.path()).unwrap(),
            );
        }
    }
    files
}

fn live_journal_phase(app_data_dir: &Path) -> RotationPhase {
    let journal: super::journal::RotationJournal =
        serde_json::from_slice(&fs::read(app_data_dir.join(JOURNAL_NAME)).unwrap()).unwrap();
    journal.phase
}

async fn assert_configuration_data_uses_key(fixture: &Fixture, key: &str) {
    let rows = configuration_rows(&fixture.database_path).await;
    assert_eq!(rows.get(&30).unwrap(), "plain configuration");
    for (id, expected) in [
        (997, "license"),
        (994, "ai configuration"),
        (10, "wallet configuration"),
        (11, "exchange configuration"),
        (20, "stock configuration"),
    ] {
        fixture
            .ent
            .decrypt_with_key(rows.get(&id).unwrap().clone(), key)
            .map(|plaintext| assert_eq!(plaintext, expected))
            .unwrap();
    }
}

fn assert_session_data_uses_key(fixture: &Fixture, key: &str) {
    let files = session_files(&fixture.app_data_dir);
    for (name, expected) in &fixture.session_plaintexts {
        fixture
            .ent
            .decrypt_with_key(files.get(name).unwrap().clone(), key)
            .map(|plaintext| assert_eq!(plaintext, *expected))
            .unwrap();
    }
}

fn fresh_ent(app_data_dir: &Path) -> Ent {
    let key_path = app_data_dir.join(".ent-key");
    let key = if key_path.exists() {
        fs::read_to_string(key_path).unwrap()
    } else {
        LEGACY_KEY.to_string()
    };
    let ent = Ent::new();
    ent.set_key(key).unwrap();
    ent
}

fn assert_no_rotation_artifacts(path: &Path) {
    for entry in fs::read_dir(path).unwrap() {
        let entry = entry.unwrap();
        let entry_path = entry.path();
        if entry.file_type().unwrap().is_dir() {
            assert_no_rotation_artifacts(&entry_path);
            continue;
        }
        let name = entry.file_name();
        let name = name.to_string_lossy();
        assert_ne!(name, ".ent-key-rotation.json");
        assert!(
            !name.contains(".rotation."),
            "rotation artifact remains: {}",
            entry_path.display()
        );
    }
}

async fn assert_all_data_uses_key(fixture: &Fixture, key: &str) {
    let rows = configuration_rows(&fixture.database_path).await;
    assert_eq!(rows.get(&30).unwrap(), "plain configuration");
    for (id, expected) in [
        (997, "license"),
        (994, "ai configuration"),
        (10, "wallet configuration"),
        (11, "exchange configuration"),
        (20, "stock configuration"),
    ] {
        let ciphertext = rows.get(&id).unwrap().clone();
        assert_eq!(
            fixture
                .ent
                .decrypt_with_key(ciphertext.clone(), key)
                .unwrap(),
            expected
        );
        let other_key = if key == NEW_KEY { OLD_KEY } else { NEW_KEY };
        assert!(fixture.ent.decrypt_with_key(ciphertext, other_key).is_err());
    }

    let files = session_files(&fixture.app_data_dir);
    assert_eq!(files.len(), fixture.session_plaintexts.len());
    for (name, expected) in &fixture.session_plaintexts {
        let ciphertext = files.get(name).unwrap().clone();
        assert_eq!(
            fixture
                .ent
                .decrypt_with_key(ciphertext.clone(), key)
                .unwrap(),
            *expected
        );
        let other_key = if key == NEW_KEY { OLD_KEY } else { NEW_KEY };
        assert!(fixture.ent.decrypt_with_key(ciphertext, other_key).is_err());
    }
}

#[test]
fn successful_rotation_reencrypts_all_targets_and_survives_restart() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;

        rotate_encryption_key(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
        )
        .await
        .unwrap();

        assert_eq!(
            fs::read_to_string(fixture.app_data_dir.join(".ent-key")).unwrap(),
            NEW_KEY
        );
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        let restarted = fresh_ent(&fixture.app_data_dir);
        for ciphertext in configuration_rows(&fixture.database_path)
            .await
            .into_values()
            .filter(|data| data.starts_with("!ent:"))
        {
            restarted.decrypt(ciphertext).unwrap();
        }
        for ciphertext in session_files(&fixture.app_data_dir).into_values() {
            restarted.decrypt(ciphertext).unwrap();
        }
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn rotation_accepts_a_legacy_key_file_with_a_trailing_newline() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        fs::write(
            fixture.app_data_dir.join(".ent-key"),
            format!("{OLD_KEY}\n"),
        )
        .unwrap();

        rotate_encryption_key(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
        )
        .await
        .unwrap();

        assert_eq!(
            fs::read_to_string(fixture.app_data_dir.join(".ent-key")).unwrap(),
            NEW_KEY
        );
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn corrupt_configuration_ciphertext_aborts_without_mutation() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        let mut connection = connect(&fixture.database_path, false).await;
        sqlx::query("UPDATE configuration SET data = '!ent:corrupt' WHERE id = 10")
            .execute(&mut connection)
            .await
            .unwrap();
        connection.close().await.unwrap();
        let rows_before = configuration_rows(&fixture.database_path).await;
        let files_before = session_files(&fixture.app_data_dir);
        let key_before = fs::read(fixture.app_data_dir.join(".ent-key")).unwrap();

        let error = rotate_encryption_key(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
        )
        .await
        .unwrap_err();

        assert!(error.contains("preflight"));
        assert_eq!(
            configuration_rows(&fixture.database_path).await,
            rows_before
        );
        assert_eq!(session_files(&fixture.app_data_dir), files_before);
        assert_eq!(
            fs::read(fixture.app_data_dir.join(".ent-key")).unwrap(),
            key_before
        );
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn corrupt_session_ciphertext_aborts_without_mutation() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        fs::write(
            fixture
                .app_data_dir
                .join("ai/sessions")
                .join(FIRST_SESSION_FILE),
            "!ent:corrupt",
        )
        .unwrap();
        let rows_before = configuration_rows(&fixture.database_path).await;
        let files_before = session_files(&fixture.app_data_dir);
        let key_before = fs::read(fixture.app_data_dir.join(".ent-key")).unwrap();

        let error = rotate_encryption_key(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
        )
        .await
        .unwrap_err();

        assert!(error.contains("preflight"));
        assert_eq!(
            configuration_rows(&fixture.database_path).await,
            rows_before
        );
        assert_eq!(session_files(&fixture.app_data_dir), files_before);
        assert_eq!(
            fs::read(fixture.app_data_dir.join(".ent-key")).unwrap(),
            key_before
        );
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn invalid_new_keys_are_rejected_without_mutation() {
    tauri::async_runtime::block_on(async {
        for invalid_key in [
            "".to_string(),
            "short".to_string(),
            " leading-key".to_string(),
            "trailing-key ".to_string(),
            "control\u{0007}key".to_string(),
            "x".repeat(4097),
        ] {
            let fixture = Fixture::new().await;
            let rows_before = configuration_rows(&fixture.database_path).await;
            let files_before = session_files(&fixture.app_data_dir);

            let error = rotate_encryption_key(
                &fixture.database_path,
                &fixture.app_data_dir,
                &fixture.ent,
                invalid_key,
            )
            .await
            .unwrap_err();

            assert!(error.contains("encryption key"));
            assert_eq!(
                configuration_rows(&fixture.database_path).await,
                rows_before
            );
            assert_eq!(session_files(&fixture.app_data_dir), files_before);
            assert_eq!(
                fs::read_to_string(fixture.app_data_dir.join(".ent-key")).unwrap(),
                OLD_KEY
            );
            assert_no_rotation_artifacts(&fixture.app_data_dir);
        }
    });
}

#[test]
fn restart_recovers_after_every_durable_phase() {
    tauri::async_runtime::block_on(async {
        for phase in [
            RotationPhase::Prepared,
            RotationPhase::FilesReplaced,
            RotationPhase::DatabaseCommitted,
            RotationPhase::KeyCommitted,
        ] {
            let fixture = Fixture::new().await;
            let error = rotate_with_failpoint(
                &fixture.database_path,
                &fixture.app_data_dir,
                &fixture.ent,
                NEW_KEY.to_string(),
                RotationFailpoint::CrashAfter(phase),
            )
            .await
            .unwrap_err();
            assert!(error.contains("simulated crash"));

            let restarted = fresh_ent(&fixture.app_data_dir);
            recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &restarted)
                .await
                .unwrap();

            assert_eq!(
                fs::read_to_string(fixture.app_data_dir.join(".ent-key")).unwrap(),
                NEW_KEY
            );
            assert_all_data_uses_key(&fixture, NEW_KEY).await;
            assert_no_rotation_artifacts(&fixture.app_data_dir);
        }
    });
}

#[test]
fn restart_recovers_after_files_change_before_journal_phase() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;

        rotate_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::CrashAfterFilesReplaced,
        )
        .await
        .unwrap_err();

        assert_eq!(
            live_journal_phase(&fixture.app_data_dir),
            RotationPhase::Prepared
        );
        assert_session_data_uses_key(&fixture, NEW_KEY);
        let rows = configuration_rows(&fixture.database_path).await;
        for (id, original) in &fixture.encrypted_rows {
            assert_eq!(rows.get(id), Some(original));
        }
        assert_eq!(
            fs::read_to_string(fixture.app_data_dir.join(".ent-key")).unwrap(),
            OLD_KEY
        );
        assert_eq!(fixture.ent.current_key().unwrap(), OLD_KEY);

        let restarted = fresh_ent(&fixture.app_data_dir);
        recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &restarted)
            .await
            .unwrap();
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn restart_recovers_after_database_commit_before_journal_phase() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;

        rotate_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::CrashAfterDatabaseCommitted,
        )
        .await
        .unwrap_err();

        assert_eq!(
            live_journal_phase(&fixture.app_data_dir),
            RotationPhase::FilesReplaced
        );
        assert_session_data_uses_key(&fixture, NEW_KEY);
        assert_configuration_data_uses_key(&fixture, NEW_KEY).await;
        assert_eq!(
            fs::read_to_string(fixture.app_data_dir.join(".ent-key")).unwrap(),
            OLD_KEY
        );
        assert_eq!(fixture.ent.current_key().unwrap(), OLD_KEY);

        let restarted = fresh_ent(&fixture.app_data_dir);
        recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &restarted)
            .await
            .unwrap();
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn restart_recovers_after_key_activation_before_journal_phase() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;

        rotate_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::CrashAfterKeyActivated,
        )
        .await
        .unwrap_err();

        assert_eq!(
            live_journal_phase(&fixture.app_data_dir),
            RotationPhase::DatabaseCommitted
        );
        assert_session_data_uses_key(&fixture, NEW_KEY);
        assert_configuration_data_uses_key(&fixture, NEW_KEY).await;
        assert_eq!(
            fs::read_to_string(fixture.app_data_dir.join(".ent-key")).unwrap(),
            NEW_KEY
        );
        assert_eq!(fixture.ent.current_key().unwrap(), NEW_KEY);

        let restarted = fresh_ent(&fixture.app_data_dir);
        recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &restarted)
            .await
            .unwrap();
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn restart_recovers_partial_backup_staging_without_removing_live_file() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        let target = fixture
            .app_data_dir
            .join("ai/sessions")
            .join(FIRST_SESSION_FILE);
        let original = fs::read_to_string(&target).unwrap();

        rotate_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::CrashDuringBackupStaging,
        )
        .await
        .unwrap_err();

        assert_eq!(fs::read_to_string(&target).unwrap(), original);
        let partial_backup = fs::read_dir(target.parent().unwrap())
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .find(|path| {
                path.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .contains(".rotation.backup.")
            })
            .unwrap();
        assert!(fs::metadata(partial_backup).unwrap().len() < original.len() as u64);

        let restarted = fresh_ent(&fixture.app_data_dir);
        recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &restarted)
            .await
            .unwrap();
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn restart_recovers_after_backup_install_before_live_replacement() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        let target = fixture
            .app_data_dir
            .join("ai/sessions")
            .join(FIRST_SESSION_FILE);
        let original = fs::read_to_string(&target).unwrap();

        rotate_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::CrashAfterBackupInstalled,
        )
        .await
        .unwrap_err();

        assert_eq!(fs::read_to_string(&target).unwrap(), original);
        assert_eq!(
            fs::read_to_string(sibling_with_suffix(&target, BACKUP_SUFFIX)).unwrap(),
            original
        );

        let restarted = fresh_ent(&fixture.app_data_dir);
        recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &restarted)
            .await
            .unwrap();
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn restart_recovers_an_interrupted_journal_replacement() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;

        rotate_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::CrashDuringJournalReplacement,
        )
        .await
        .unwrap_err();

        let journal_path = fixture.app_data_dir.join(JOURNAL_NAME);
        let live: serde_json::Value =
            serde_json::from_slice(&fs::read(&journal_path).unwrap()).unwrap();
        let staged_path = fs::read_dir(&fixture.app_data_dir)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .find(|path| {
                path.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with(".ent-key-rotation.json.rotation.journal.")
            })
            .unwrap();
        let staged: serde_json::Value =
            serde_json::from_slice(&fs::read(staged_path).unwrap()).unwrap();
        assert_eq!(live["phase"], "Prepared");
        assert_eq!(staged["phase"], "FilesReplaced");

        let restarted = fresh_ent(&fixture.app_data_dir);
        recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &restarted)
            .await
            .unwrap();
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn operational_failures_restore_the_old_consistent_state() {
    tauri::async_runtime::block_on(async {
        for failpoint in [
            RotationFailpoint::DuringFileReplacement,
            RotationFailpoint::DuringDatabaseCommit,
            RotationFailpoint::DuringKeyReplacement,
        ] {
            let fixture = Fixture::new().await;
            let error = rotate_with_failpoint(
                &fixture.database_path,
                &fixture.app_data_dir,
                &fixture.ent,
                NEW_KEY.to_string(),
                failpoint,
            )
            .await
            .unwrap_err();
            assert!(error.contains("simulated failure"));

            assert_eq!(
                fs::read_to_string(fixture.app_data_dir.join(".ent-key")).unwrap(),
                OLD_KEY
            );
            assert_all_data_uses_key(&fixture, OLD_KEY).await;
            let restarted = fresh_ent(&fixture.app_data_dir);
            for ciphertext in configuration_rows(&fixture.database_path)
                .await
                .into_values()
                .filter(|data| data.starts_with("!ent:"))
            {
                restarted.decrypt(ciphertext).unwrap();
            }
            assert_no_rotation_artifacts(&fixture.app_data_dir);
        }
    });
}

#[test]
fn rollback_failure_returns_structured_recovery_required_error() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;

        let error = rotate_for_command_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::DuringRollback,
        )
        .await
        .unwrap_err();

        assert!(matches!(
            error,
            RotationCommandError::RecoveryRequired { ref message }
                if message == RECOVERY_REQUIRED_MESSAGE
        ));
        assert_eq!(
            serde_json::to_value(&error).unwrap(),
            serde_json::json!({
                "code": "recovery_required",
                "message": RECOVERY_REQUIRED_MESSAGE,
            })
        );
        assert!(fixture.app_data_dir.join(JOURNAL_NAME).exists());

        let restarted = fresh_ent(&fixture.app_data_dir);
        recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &restarted)
            .await
            .unwrap();
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn successful_rollback_returns_a_structured_non_poisoning_error() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;

        let error = rotate_for_command_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::DuringDatabaseCommit,
        )
        .await
        .unwrap_err();

        assert_eq!(
            serde_json::to_value(error).unwrap(),
            serde_json::json!({
                "code": "failed",
                "message": "simulated failure during database commit",
            })
        );
        assert_all_data_uses_key(&fixture, OLD_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn concurrent_rotations_are_serialized_to_one_consistent_key() {
    let fixture = tauri::async_runtime::block_on(Fixture::new());
    let barrier = Arc::new(Barrier::new(3));
    let first_database = fixture.database_path.clone();
    let first_app_data = fixture.app_data_dir.clone();
    let first_ent = Arc::clone(&fixture.ent);
    let first_barrier = Arc::clone(&barrier);
    let first = thread::spawn(move || {
        first_barrier.wait();
        tauri::async_runtime::block_on(rotate_encryption_key(
            &first_database,
            &first_app_data,
            &first_ent,
            "concurrent-key-one".to_string(),
        ))
    });
    let second_database = fixture.database_path.clone();
    let second_app_data = fixture.app_data_dir.clone();
    let second_ent = Arc::clone(&fixture.ent);
    let second_barrier = Arc::clone(&barrier);
    let second = thread::spawn(move || {
        second_barrier.wait();
        tauri::async_runtime::block_on(rotate_encryption_key(
            &second_database,
            &second_app_data,
            &second_ent,
            "concurrent-key-two".to_string(),
        ))
    });

    barrier.wait();
    first.join().unwrap().unwrap();
    second.join().unwrap().unwrap();

    let final_key = fs::read_to_string(fixture.app_data_dir.join(".ent-key")).unwrap();
    assert!(matches!(
        final_key.as_str(),
        "concurrent-key-one" | "concurrent-key-two"
    ));
    tauri::async_runtime::block_on(assert_all_data_uses_key(&fixture, &final_key));
    assert_no_rotation_artifacts(&fixture.app_data_dir);
}

#[test]
fn rotation_waits_for_the_process_lock() {
    let fixture = tauri::async_runtime::block_on(Fixture::new());
    let rotation_guard = tauri::async_runtime::block_on(super::ROTATION_MUTEX.lock());
    let database_path = fixture.database_path.clone();
    let app_data_dir = fixture.app_data_dir.clone();
    let ent = Arc::clone(&fixture.ent);
    let (started_tx, started_rx) = mpsc::channel();
    let (result_tx, result_rx) = mpsc::channel();

    let rotation = thread::spawn(move || {
        started_tx.send(()).unwrap();
        let result = tauri::async_runtime::block_on(rotate_encryption_key(
            &database_path,
            &app_data_dir,
            &ent,
            "short".to_string(),
        ));
        result_tx.send(result).unwrap();
    });

    started_rx.recv_timeout(Duration::from_secs(1)).unwrap();
    assert!(matches!(
        result_rx.recv_timeout(Duration::from_millis(100)),
        Err(mpsc::RecvTimeoutError::Timeout)
    ));

    drop(rotation_guard);
    let error = result_rx
        .recv_timeout(Duration::from_secs(10))
        .unwrap()
        .unwrap_err();
    assert!(error.contains("at least 8 characters"));
    rotation.join().unwrap();
    tauri::async_runtime::block_on(assert_all_data_uses_key(&fixture, OLD_KEY));
    assert_no_rotation_artifacts(&fixture.app_data_dir);
}

#[test]
fn replacement_strategy_never_removes_an_existing_target() {
    assert_eq!(
        replacement_strategy(false),
        ReplacementStrategy::RenameAbsent
    );
    assert_eq!(
        replacement_strategy(true),
        ReplacementStrategy::AtomicReplaceExisting
    );
}

#[test]
fn windows_move_policy_always_requests_write_through() {
    assert_eq!(windows_move_flags(false), 0x8);
    assert_eq!(windows_move_flags(true), 0x9);
}

#[test]
fn staging_files_are_unique_and_never_opened_by_truncation() {
    let directory = TestDirectory::new();
    let target = directory.0.join("target");

    let first = write_random_restricted(&target, "replacement", b"first").unwrap();
    let second = write_random_restricted(&target, "replacement", b"second").unwrap();

    assert_ne!(first, second);
    assert_eq!(fs::read(&first).unwrap(), b"first");
    assert_eq!(fs::read(&second).unwrap(), b"second");
    cleanup_file_artifacts(&target).unwrap();
}

#[test]
fn journal_unlink_failure_after_key_commit_never_rolls_back() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;

        let error = rotate_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::DuringJournalUnlink,
        )
        .await
        .unwrap_err();

        assert!(error.contains("committed"));
        assert_eq!(
            live_journal_phase(&fixture.app_data_dir),
            RotationPhase::KeyCommitted
        );
        assert_eq!(fixture.ent.current_key().unwrap(), NEW_KEY);
        assert_all_data_uses_key(&fixture, NEW_KEY).await;

        let restarted = fresh_ent(&fixture.app_data_dir);
        recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &restarted)
            .await
            .unwrap();
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn parent_sync_uncertainty_after_journal_unlink_is_committed_success() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;

        rotate_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::AfterJournalUnlinkBeforeParentSync,
        )
        .await
        .unwrap();

        assert_eq!(fixture.ent.current_key().unwrap(), NEW_KEY);
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn key_committed_journal_parent_sync_failure_never_rolls_back() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;

        let error = rotate_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::DuringKeyCommittedJournalParentSync,
        )
        .await
        .unwrap_err();

        assert!(error.contains("committed"));
        assert_eq!(fixture.ent.current_key().unwrap(), NEW_KEY);
        assert_configuration_data_uses_key(&fixture, NEW_KEY).await;
        assert_session_data_uses_key(&fixture, NEW_KEY);
        assert_eq!(
            live_journal_phase(&fixture.app_data_dir),
            RotationPhase::KeyCommitted
        );

        let restarted = fresh_ent(&fixture.app_data_dir);
        recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &restarted)
            .await
            .unwrap();
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn oversized_journal_is_rejected_before_deserialization() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        let journal_path = fixture.app_data_dir.join(JOURNAL_NAME);
        let file = fs::File::create(journal_path).unwrap();
        file.set_len(MAX_JOURNAL_BYTES as u64 + 1).unwrap();

        let error =
            recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &fixture.ent)
                .await
                .unwrap_err();

        assert!(error.contains("too large"));
        assert_all_data_uses_key(&fixture, OLD_KEY).await;
    });
}

#[test]
fn oversized_ciphertext_is_rejected_before_first_journal_persistence() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        let oversized = fixture.ent.encrypt("x".repeat(13 * 1024 * 1024)).unwrap();
        assert!(oversized.len() > MAX_CIPHERTEXT_BYTES);
        let mut connection = connect(&fixture.database_path, false).await;
        sqlx::query("UPDATE configuration SET data = ? WHERE id = 10")
            .bind(&oversized)
            .execute(&mut connection)
            .await
            .unwrap();
        connection.close().await.unwrap();

        let journal = preflight::prepare(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
        )
        .await
        .unwrap();
        assert!(serde_json::to_vec(&journal).unwrap().len() < MAX_JOURNAL_BYTES);
        let rows_before = configuration_rows(&fixture.database_path).await;
        let sessions_before = session_files(&fixture.app_data_dir);
        let key_before = fs::read_to_string(fixture.app_data_dir.join(".ent-key")).unwrap();

        let error = rotate_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::CrashAfter(RotationPhase::Prepared),
        )
        .await
        .unwrap_err();

        assert!(error.contains("oversized ciphertext"));
        assert_eq!(
            configuration_rows(&fixture.database_path).await,
            rows_before
        );
        assert_eq!(session_files(&fixture.app_data_dir), sessions_before);
        assert_eq!(
            fs::read_to_string(fixture.app_data_dir.join(".ent-key")).unwrap(),
            key_before
        );
        assert_eq!(fixture.ent.current_key().unwrap(), OLD_KEY);
        assert!(!fixture.app_data_dir.join(JOURNAL_NAME).exists());
    });
}

#[test]
fn recovery_rejects_an_oversized_ciphertext_in_a_sub_limit_journal() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        let oversized = fixture.ent.encrypt("x".repeat(13 * 1024 * 1024)).unwrap();
        let mut connection = connect(&fixture.database_path, false).await;
        sqlx::query("UPDATE configuration SET data = ? WHERE id = 10")
            .bind(&oversized)
            .execute(&mut connection)
            .await
            .unwrap();
        connection.close().await.unwrap();
        let journal = preflight::prepare(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
        )
        .await
        .unwrap();
        assert!(journal.configurations.iter().any(|configuration| {
            configuration.old_ciphertext.len() > MAX_CIPHERTEXT_BYTES
                || configuration.new_ciphertext.len() > MAX_CIPHERTEXT_BYTES
        }));
        assert!(serde_json::to_vec(&journal).unwrap().len() < MAX_JOURNAL_BYTES);
        super::journal::write(&fixture.app_data_dir, &journal).unwrap();
        let rows_before = configuration_rows(&fixture.database_path).await;
        let sessions_before = session_files(&fixture.app_data_dir);

        let error =
            recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &fixture.ent)
                .await
                .unwrap_err();

        assert!(error.contains("oversized ciphertext"));
        assert_eq!(
            configuration_rows(&fixture.database_path).await,
            rows_before
        );
        assert_eq!(session_files(&fixture.app_data_dir), sessions_before);
        assert_eq!(fixture.ent.current_key().unwrap(), OLD_KEY);
    });
}

#[cfg(unix)]
#[test]
fn symlinked_sessions_directory_is_rejected_without_touching_outside_files() {
    use std::os::unix::fs::symlink;

    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        let sessions_dir = fixture.app_data_dir.join("ai/sessions");
        fs::remove_dir_all(&sessions_dir).unwrap();
        let outside = fixture._root.0.join("outside-sessions");
        fs::create_dir(&outside).unwrap();
        let outside_file = outside.join(FIRST_SESSION_FILE);
        fs::write(&outside_file, "outside sentinel").unwrap();
        symlink(&outside, &sessions_dir).unwrap();
        let rows_before = configuration_rows(&fixture.database_path).await;

        let error = rotate_encryption_key(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
        )
        .await
        .unwrap_err();

        assert!(error.contains("session"));
        assert_eq!(
            fs::read_to_string(outside_file).unwrap(),
            "outside sentinel"
        );
        assert_eq!(
            configuration_rows(&fixture.database_path).await,
            rows_before
        );
        assert_eq!(fixture.ent.current_key().unwrap(), OLD_KEY);
    });
}

#[cfg(unix)]
#[test]
fn symlinked_session_artifact_is_rejected_without_touching_its_target() {
    use std::os::unix::fs::symlink;

    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        let outside_file = fixture._root.0.join("outside-artifact");
        fs::write(&outside_file, "outside sentinel").unwrap();
        let artifact = fixture
            .app_data_dir
            .join("ai/sessions")
            .join(format!("{FIRST_SESSION_FILE}.tmp"));
        symlink(&outside_file, artifact).unwrap();
        let rows_before = configuration_rows(&fixture.database_path).await;

        let error = rotate_encryption_key(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
        )
        .await
        .unwrap_err();

        assert!(error.contains("artifact"));
        assert_eq!(
            fs::read_to_string(outside_file).unwrap(),
            "outside sentinel"
        );
        assert_eq!(
            configuration_rows(&fixture.database_path).await,
            rows_before
        );
        assert_eq!(fixture.ent.current_key().unwrap(), OLD_KEY);
    });
}

#[cfg(unix)]
#[test]
fn symlinked_live_session_file_is_rejected_without_touching_its_target() {
    use std::os::unix::fs::symlink;

    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        let session_path = fixture
            .app_data_dir
            .join("ai/sessions")
            .join(FIRST_SESSION_FILE);
        fs::remove_file(&session_path).unwrap();
        let outside_file = fixture._root.0.join("outside-session");
        fs::write(&outside_file, "outside sentinel").unwrap();
        symlink(&outside_file, session_path).unwrap();
        let rows_before = configuration_rows(&fixture.database_path).await;

        let error = rotate_encryption_key(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
        )
        .await
        .unwrap_err();

        assert!(error.contains("symbolic link"));
        assert_eq!(
            fs::read_to_string(outside_file).unwrap(),
            "outside sentinel"
        );
        assert_eq!(
            configuration_rows(&fixture.database_path).await,
            rows_before
        );
        assert_eq!(fixture.ent.current_key().unwrap(), OLD_KEY);
    });
}

#[test]
fn non_uuid_session_file_is_rejected_before_mutation() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        let invalid_path = fixture.app_data_dir.join("ai/sessions/not-a-uuid.json.ent");
        fs::write(&invalid_path, "sentinel").unwrap();
        let rows_before = configuration_rows(&fixture.database_path).await;

        let error = rotate_encryption_key(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
        )
        .await
        .unwrap_err();

        assert!(error.contains("invalid session file name"));
        assert_eq!(fs::read_to_string(invalid_path).unwrap(), "sentinel");
        assert_eq!(
            configuration_rows(&fixture.database_path).await,
            rows_before
        );
        assert_eq!(fixture.ent.current_key().unwrap(), OLD_KEY);
        assert!(!fixture.app_data_dir.join(JOURNAL_NAME).exists());
    });
}

#[test]
fn restart_recovers_an_interrupted_cross_platform_key_replacement() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;
        rotate_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::CrashAfter(RotationPhase::DatabaseCommitted),
        )
        .await
        .unwrap_err();

        let key_path = fixture.app_data_dir.join(".ent-key");
        fs::write(sibling_with_suffix(&key_path, BACKUP_SUFFIX), OLD_KEY).unwrap();
        fs::remove_file(&key_path).unwrap();
        let restarted = fresh_ent(&fixture.app_data_dir);

        recover_pending_rotation(&fixture.database_path, &fixture.app_data_dir, &restarted)
            .await
            .unwrap();

        assert_eq!(fs::read_to_string(key_path).unwrap(), NEW_KEY);
        assert_all_data_uses_key(&fixture, NEW_KEY).await;
        assert_no_rotation_artifacts(&fixture.app_data_dir);
    });
}

#[test]
fn preflight_preserves_original_ciphertext_until_journal_is_durable() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new().await;

        rotate_with_failpoint(
            &fixture.database_path,
            &fixture.app_data_dir,
            &fixture.ent,
            NEW_KEY.to_string(),
            RotationFailpoint::CrashAfter(RotationPhase::Prepared),
        )
        .await
        .unwrap_err();

        let rows = configuration_rows(&fixture.database_path).await;
        for (id, ciphertext) in &fixture.encrypted_rows {
            assert_eq!(rows.get(id), Some(ciphertext));
        }
        assert_all_data_uses_key(&fixture, OLD_KEY).await;
    });
}
