mod database;
mod files;
mod journal;
mod preflight;

use serde::Serialize;
use std::{collections::HashSet, path::Path};
use tokio::sync::Mutex;

use crate::ent::Ent;
use crate::startup_security::validate_encryption_key_material;

use files::{
    cleanup_file_artifacts, install_contents, install_key_contents, read_optional_string,
    remove_if_exists, restore_contents, session_path, sibling_with_suffix,
    validate_session_file_name, FileInstallFailpoint, BACKUP_SUFFIX, KEY_FILE_NAME,
};
use journal::{CleanupFailpoint, RotationJournal};

static ROTATION_MUTEX: Mutex<()> = Mutex::const_new(());
const MAX_CIPHERTEXT_BYTES: usize = 16 * 1024 * 1024;
pub const RECOVERY_REQUIRED_MESSAGE: &str =
    "Encryption key recovery is required. Restart Track3 before making further changes.";

pub use journal::RotationPhase;

#[derive(PartialEq, Serialize)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum RotationCommandError {
    Failed { message: String },
    RecoveryRequired { message: String },
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum RotationFailpoint {
    None,
    CrashAfter(RotationPhase),
    CrashAfterFilesReplaced,
    CrashAfterDatabaseCommitted,
    CrashAfterKeyActivated,
    #[cfg_attr(not(test), allow(dead_code))]
    CrashDuringBackupStaging,
    #[cfg_attr(not(test), allow(dead_code))]
    CrashAfterBackupInstalled,
    CrashDuringJournalReplacement,
    DuringFileReplacement,
    #[cfg_attr(not(test), allow(dead_code))]
    DuringDatabaseCommit,
    DuringKeyReplacement,
    #[cfg_attr(not(test), allow(dead_code))]
    DuringRollback,
    #[cfg_attr(not(test), allow(dead_code))]
    DuringKeyCommittedJournalParentSync,
    #[cfg_attr(not(test), allow(dead_code))]
    DuringJournalUnlink,
    #[cfg_attr(not(test), allow(dead_code))]
    AfterJournalUnlinkBeforeParentSync,
}

enum ExecutionError {
    Crash(String),
    Operational(String),
    CommittedWarning(String),
}

enum RotationFailure {
    Failed(String),
    RecoveryRequired(String),
}

impl RotationFailure {
    fn failed(error: impl Into<String>) -> Self {
        Self::Failed(error.into())
    }

    fn recovery_required(error: impl Into<String>) -> Self {
        Self::RecoveryRequired(error.into())
    }

    fn into_message(self) -> String {
        match self {
            Self::Failed(error) | Self::RecoveryRequired(error) => error,
        }
    }

    fn into_command_error(self) -> RotationCommandError {
        match self {
            Self::Failed(message) => RotationCommandError::Failed { message },
            Self::RecoveryRequired(_) => RotationCommandError::RecoveryRequired {
                message: RECOVERY_REQUIRED_MESSAGE.to_string(),
            },
        }
    }
}

impl ExecutionError {
    fn crash(error: impl Into<String>) -> Self {
        Self::Crash(error.into())
    }

    fn operational(error: impl Into<String>) -> Self {
        Self::Operational(error.into())
    }

    fn committed_warning(error: impl Into<String>) -> Self {
        Self::CommittedWarning(error.into())
    }

    fn into_message(self) -> String {
        match self {
            Self::Crash(error) | Self::Operational(error) | Self::CommittedWarning(error) => error,
        }
    }
}

pub async fn rotate_encryption_key(
    database_path: &Path,
    app_data_dir: &Path,
    ent: &Ent,
    new_key: String,
) -> Result<(), String> {
    let _rotation_guard = ROTATION_MUTEX.lock().await;
    rotate_locked(
        database_path,
        app_data_dir,
        ent,
        new_key,
        RotationFailpoint::None,
    )
    .await
    .map_err(RotationFailure::into_message)
}

pub async fn rotate_encryption_key_for_command(
    database_path: &Path,
    app_data_dir: &Path,
    ent: &Ent,
    new_key: String,
) -> Result<(), RotationCommandError> {
    let _rotation_guard = ROTATION_MUTEX.lock().await;
    rotate_locked(
        database_path,
        app_data_dir,
        ent,
        new_key,
        RotationFailpoint::None,
    )
    .await
    .map_err(RotationFailure::into_command_error)
}

pub async fn recover_pending_rotation(
    database_path: &Path,
    app_data_dir: &Path,
    ent: &Ent,
) -> Result<(), String> {
    let _rotation_guard = ROTATION_MUTEX.lock().await;
    recover_locked(database_path, app_data_dir, ent).await
}

#[cfg(test)]
async fn rotate_with_failpoint(
    database_path: &Path,
    app_data_dir: &Path,
    ent: &Ent,
    new_key: String,
    failpoint: RotationFailpoint,
) -> Result<(), String> {
    let _rotation_guard = ROTATION_MUTEX.lock().await;
    rotate_locked(database_path, app_data_dir, ent, new_key, failpoint)
        .await
        .map_err(RotationFailure::into_message)
}

#[cfg(test)]
async fn rotate_for_command_with_failpoint(
    database_path: &Path,
    app_data_dir: &Path,
    ent: &Ent,
    new_key: String,
    failpoint: RotationFailpoint,
) -> Result<(), RotationCommandError> {
    let _rotation_guard = ROTATION_MUTEX.lock().await;
    rotate_locked(database_path, app_data_dir, ent, new_key, failpoint)
        .await
        .map_err(RotationFailure::into_command_error)
}

async fn rotate_locked(
    database_path: &Path,
    app_data_dir: &Path,
    ent: &Ent,
    new_key: String,
    failpoint: RotationFailpoint,
) -> Result<(), RotationFailure> {
    validate_new_key(&new_key).map_err(RotationFailure::failed)?;
    recover_locked(database_path, app_data_dir, ent)
        .await
        .map_err(RotationFailure::recovery_required)?;

    let mut journal = preflight::prepare(database_path, app_data_dir, ent, new_key)
        .await
        .map_err(RotationFailure::failed)?;
    validate_journal(&journal).map_err(RotationFailure::failed)?;
    journal::write(app_data_dir, &journal).map_err(RotationFailure::failed)?;

    match execute_forward(database_path, app_data_dir, ent, &mut journal, failpoint).await {
        Ok(()) => Ok(()),
        Err(ExecutionError::Crash(error)) => Err(RotationFailure::recovery_required(error)),
        Err(ExecutionError::CommittedWarning(error)) => {
            Err(RotationFailure::recovery_required(error))
        }
        Err(ExecutionError::Operational(error)) => {
            if journal.phase == RotationPhase::KeyCommitted {
                match journal::live_matches(app_data_dir, &journal) {
                    Ok(true) => {
                        return Err(RotationFailure::recovery_required(format!(
                            "encryption key committed; cleanup will resume at startup: {error}"
                        )));
                    }
                    Err(status_error) => {
                        return Err(RotationFailure::recovery_required(format!(
                            "encryption key commit status is uncertain; refusing rollback: \
                             {error}; {status_error}"
                        )));
                    }
                    Ok(false) => {}
                }
            }
            let rollback_result = if failpoint == RotationFailpoint::DuringRollback {
                Err("simulated rollback failure".to_string())
            } else {
                rollback_rotation(database_path, app_data_dir, ent, &journal).await
            };
            match rollback_result {
                Ok(()) => Err(RotationFailure::failed(error)),
                Err(rollback_error) => Err(RotationFailure::recovery_required(format!(
                    "{error}; rollback failed and will be retried at startup: {rollback_error}"
                ))),
            }
        }
    }
}

async fn recover_locked(
    database_path: &Path,
    app_data_dir: &Path,
    ent: &Ent,
) -> Result<(), String> {
    let Some(mut journal) = journal::read(app_data_dir)? else {
        return Ok(());
    };
    validate_journal(&journal)?;
    align_active_key_for_recovery(app_data_dir, ent, &journal)?;

    match execute_forward(
        database_path,
        app_data_dir,
        ent,
        &mut journal,
        RotationFailpoint::None,
    )
    .await
    {
        Ok(()) | Err(ExecutionError::CommittedWarning(_)) => Ok(()),
        Err(error) => Err(error.into_message()),
    }
}

fn align_active_key_for_recovery(
    app_data_dir: &Path,
    ent: &Ent,
    journal: &RotationJournal,
) -> Result<(), String> {
    let current = ent.current_key()?;
    if current == journal.old_key || current == journal.new_key {
        return Ok(());
    }

    let key_path = app_data_dir.join(KEY_FILE_NAME);
    let persisted_key = read_optional_string(&key_path)?;
    let backup_key = read_optional_string(&sibling_with_suffix(&key_path, BACKUP_SUFFIX))?;
    let recovered_key = match persisted_key.as_deref() {
        Some(key) if key == journal.old_key => &journal.old_key,
        Some(key) if key == journal.new_key => &journal.new_key,
        Some(_) => {
            return Err("persisted encryption key does not match rotation journal".to_string())
        }
        None if backup_key.as_deref() == Some(journal.old_key.as_str()) => &journal.old_key,
        None if !journal.key_file_existed => &journal.old_key,
        None => return Err("encryption key recovery metadata is incomplete".to_string()),
    };
    ent.change_key(recovered_key.clone())?;
    Ok(())
}

fn validate_new_key(key: &str) -> Result<(), String> {
    if key.chars().count() < 8 {
        return Err("encryption key must be at least 8 characters".to_string());
    }
    if key.trim() != key {
        return Err("encryption key must not have leading or trailing whitespace".to_string());
    }
    validate_encryption_key_material(key)?;
    Ok(())
}

async fn execute_forward(
    database_path: &Path,
    app_data_dir: &Path,
    ent: &Ent,
    journal: &mut RotationJournal,
    failpoint: RotationFailpoint,
) -> Result<(), ExecutionError> {
    crash_after(failpoint, RotationPhase::Prepared)?;

    replace_session_files(app_data_dir, journal, failpoint)?;
    crash_at(
        failpoint,
        RotationFailpoint::CrashAfterFilesReplaced,
        "simulated crash after files replaced",
    )?;
    journal.phase = RotationPhase::FilesReplaced;
    persist_journal(app_data_dir, journal, failpoint)?;
    crash_after(failpoint, RotationPhase::FilesReplaced)?;

    database::replace_configuration_rows(database_path, journal, true).await?;
    if matches!(
        failpoint,
        RotationFailpoint::DuringDatabaseCommit | RotationFailpoint::DuringRollback
    ) {
        return Err(ExecutionError::operational(
            "simulated failure during database commit",
        ));
    }
    crash_at(
        failpoint,
        RotationFailpoint::CrashAfterDatabaseCommitted,
        "simulated crash after database committed",
    )?;
    journal.phase = RotationPhase::DatabaseCommitted;
    journal::write(app_data_dir, journal).map_err(ExecutionError::operational)?;
    crash_after(failpoint, RotationPhase::DatabaseCommitted)?;

    preflight::verify_new_ciphertext(database_path, app_data_dir, ent, journal)
        .await
        .map_err(ExecutionError::operational)?;
    replace_key_file(app_data_dir, journal, failpoint)?;
    activate_key(ent, &journal.old_key, &journal.new_key).map_err(ExecutionError::operational)?;
    crash_at(
        failpoint,
        RotationFailpoint::CrashAfterKeyActivated,
        "simulated crash after key activation",
    )?;
    journal.phase = RotationPhase::KeyCommitted;
    if failpoint == RotationFailpoint::DuringKeyCommittedJournalParentSync {
        journal::write_with_parent_sync_failpoint(app_data_dir, journal)
            .map_err(ExecutionError::operational)?;
    } else {
        journal::write(app_data_dir, journal).map_err(ExecutionError::operational)?;
    }
    crash_after(failpoint, RotationPhase::KeyCommitted)?;

    let cleanup_failpoint = match failpoint {
        RotationFailpoint::DuringJournalUnlink => CleanupFailpoint::DuringJournalUnlink,
        RotationFailpoint::AfterJournalUnlinkBeforeParentSync => {
            CleanupFailpoint::AfterJournalUnlinkBeforeParentSync
        }
        _ => CleanupFailpoint::None,
    };
    cleanup_rotation(app_data_dir, journal, cleanup_failpoint).map_err(|error| {
        ExecutionError::committed_warning(format!(
            "encryption key committed; cleanup incomplete: {error}"
        ))
    })
}

fn persist_journal(
    app_data_dir: &Path,
    journal: &RotationJournal,
    failpoint: RotationFailpoint,
) -> Result<(), ExecutionError> {
    let staged = journal::stage(app_data_dir, journal).map_err(ExecutionError::operational)?;
    if failpoint == RotationFailpoint::CrashDuringJournalReplacement {
        return Err(ExecutionError::crash(
            "simulated crash during journal replacement",
        ));
    }
    journal::install_staged(app_data_dir, &staged).map_err(ExecutionError::operational)
}

fn crash_after(failpoint: RotationFailpoint, phase: RotationPhase) -> Result<(), ExecutionError> {
    if failpoint == RotationFailpoint::CrashAfter(phase) {
        return Err(ExecutionError::crash(format!(
            "simulated crash after {phase:?}"
        )));
    }
    Ok(())
}

fn crash_at(
    failpoint: RotationFailpoint,
    expected: RotationFailpoint,
    message: &str,
) -> Result<(), ExecutionError> {
    if failpoint == expected {
        return Err(ExecutionError::crash(message));
    }
    Ok(())
}

fn replace_session_files(
    app_data_dir: &Path,
    journal: &RotationJournal,
    failpoint: RotationFailpoint,
) -> Result<(), ExecutionError> {
    for (index, session) in journal.sessions.iter().enumerate() {
        let target =
            session_path(app_data_dir, &session.file_name).map_err(ExecutionError::operational)?;
        let file_failpoint = if index == 0 {
            match failpoint {
                RotationFailpoint::CrashDuringBackupStaging => {
                    FileInstallFailpoint::CrashDuringBackupStaging
                }
                RotationFailpoint::CrashAfterBackupInstalled => {
                    FileInstallFailpoint::CrashAfterBackupInstalled
                }
                RotationFailpoint::DuringFileReplacement => {
                    FileInstallFailpoint::OperationalAfterBackupInstalled
                }
                _ => FileInstallFailpoint::None,
            }
        } else {
            FileInstallFailpoint::None
        };
        install_contents(
            &target,
            &session.old_ciphertext,
            &session.new_ciphertext,
            file_failpoint,
        )?;
    }
    if journal.sessions.is_empty() && failpoint == RotationFailpoint::DuringFileReplacement {
        return Err(ExecutionError::operational(
            "simulated failure during file replacement",
        ));
    }
    Ok(())
}

fn replace_key_file(
    app_data_dir: &Path,
    journal: &RotationJournal,
    failpoint: RotationFailpoint,
) -> Result<(), ExecutionError> {
    let key_path = app_data_dir.join(KEY_FILE_NAME);
    install_key_contents(
        &key_path,
        journal.key_file_existed,
        &journal.old_key,
        &journal.new_key,
    )
    .map_err(ExecutionError::operational)?;
    if failpoint == RotationFailpoint::DuringKeyReplacement {
        return Err(ExecutionError::operational(
            "simulated failure during key replacement",
        ));
    }
    Ok(())
}

fn activate_key(ent: &Ent, old_key: &str, new_key: &str) -> Result<(), String> {
    let current = ent.current_key()?;
    if current == new_key {
        return Ok(());
    }
    if current != old_key {
        return Err("active encryption key does not match rotation journal".to_string());
    }
    ent.change_key(new_key.to_string())?;
    Ok(())
}

async fn rollback_rotation(
    database_path: &Path,
    app_data_dir: &Path,
    ent: &Ent,
    journal: &RotationJournal,
) -> Result<(), String> {
    database::replace_configuration_rows(database_path, journal, false)
        .await
        .map_err(ExecutionError::into_message)?;
    restore_session_files(app_data_dir, journal)?;
    restore_key_file(app_data_dir, ent, journal)?;
    cleanup_rotation(app_data_dir, journal, CleanupFailpoint::None)
}

fn restore_session_files(app_data_dir: &Path, journal: &RotationJournal) -> Result<(), String> {
    for session in &journal.sessions {
        let path = session_path(app_data_dir, &session.file_name)?;
        restore_contents(&path, &session.old_ciphertext, &session.new_ciphertext)?;
    }
    Ok(())
}

fn restore_key_file(
    app_data_dir: &Path,
    ent: &Ent,
    journal: &RotationJournal,
) -> Result<(), String> {
    let key_path = app_data_dir.join(KEY_FILE_NAME);
    if journal.key_file_existed {
        restore_contents(&key_path, &journal.old_key, &journal.new_key)?;
    } else {
        remove_if_exists(&key_path)?;
        cleanup_file_artifacts(&key_path)?;
    }

    let current = ent.current_key()?;
    if current == journal.new_key {
        ent.change_key(journal.old_key.clone())?;
    } else if current != journal.old_key {
        return Err("active encryption key does not match rotation journal".to_string());
    }
    Ok(())
}

fn cleanup_rotation(
    app_data_dir: &Path,
    journal: &RotationJournal,
    failpoint: CleanupFailpoint,
) -> Result<(), String> {
    for session in &journal.sessions {
        let path = session_path(app_data_dir, &session.file_name)?;
        cleanup_file_artifacts(&path)?;
    }
    let key_path = app_data_dir.join(KEY_FILE_NAME);
    cleanup_file_artifacts(&key_path)?;
    journal::cleanup(app_data_dir, failpoint)
}

fn validate_journal(journal: &RotationJournal) -> Result<(), String> {
    validate_encryption_key_material(&journal.old_key)?;
    validate_new_key(&journal.new_key)?;
    let mut configuration_ids = HashSet::new();
    for configuration in &journal.configurations {
        if !configuration_ids.insert(configuration.id) {
            return Err("rotation journal contains duplicate configuration rows".to_string());
        }
        validate_ciphertext(&configuration.old_ciphertext)?;
        validate_ciphertext(&configuration.new_ciphertext)?;
    }
    let mut session_names = HashSet::new();
    for session in &journal.sessions {
        validate_session_file_name(&session.file_name)?;
        if !session_names.insert(&session.file_name) {
            return Err("rotation journal contains duplicate session files".to_string());
        }
        validate_ciphertext(&session.old_ciphertext)?;
        validate_ciphertext(&session.new_ciphertext)?;
    }
    Ok(())
}

fn validate_ciphertext(ciphertext: &str) -> Result<(), String> {
    if ciphertext.len() > MAX_CIPHERTEXT_BYTES {
        return Err("rotation journal contains oversized ciphertext".to_string());
    }
    if !ciphertext.starts_with("!ent:") || ciphertext.chars().any(char::is_control) {
        return Err("rotation journal contains invalid ciphertext".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests;
