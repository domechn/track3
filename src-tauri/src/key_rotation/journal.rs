use std::{
    fs::{self, File, OpenOptions},
    io::{ErrorKind, Read},
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

use super::files::{
    cleanup_file_artifacts, reject_link_or_reparse_point, remove_if_exists_without_sync,
    replace_staged, replace_staged_with_parent_sync_failpoint, sync_parent,
    write_random_restricted,
};

pub(super) const JOURNAL_NAME: &str = ".ent-key-rotation.json";
pub(super) const MAX_JOURNAL_BYTES: usize = 64 * 1024 * 1024;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
pub enum RotationPhase {
    Prepared,
    FilesReplaced,
    DatabaseCommitted,
    KeyCommitted,
}

#[derive(Clone, Deserialize, PartialEq, Serialize)]
pub(super) struct ConfigurationRotation {
    pub(super) id: i64,
    pub(super) old_ciphertext: String,
    pub(super) new_ciphertext: String,
}

#[derive(Clone, Deserialize, PartialEq, Serialize)]
pub(super) struct SessionRotation {
    pub(super) file_name: String,
    pub(super) old_ciphertext: String,
    pub(super) new_ciphertext: String,
}

#[derive(Clone, Deserialize, PartialEq, Serialize)]
pub(super) struct RotationJournal {
    pub(super) phase: RotationPhase,
    pub(super) old_key: String,
    pub(super) new_key: String,
    pub(super) key_file_existed: bool,
    pub(super) configurations: Vec<ConfigurationRotation>,
    pub(super) sessions: Vec<SessionRotation>,
}

#[derive(Clone, Copy, PartialEq)]
pub(super) enum CleanupFailpoint {
    None,
    DuringJournalUnlink,
    AfterJournalUnlinkBeforeParentSync,
}

pub(super) fn write(app_data_dir: &Path, journal: &RotationJournal) -> Result<(), String> {
    let staged = stage(app_data_dir, journal)?;
    install_staged(app_data_dir, &staged)
}

pub(super) fn write_with_parent_sync_failpoint(
    app_data_dir: &Path,
    journal: &RotationJournal,
) -> Result<(), String> {
    let staged = stage(app_data_dir, journal)?;
    replace_staged_with_parent_sync_failpoint(&staged, &path(app_data_dir), true)
}

pub(super) fn stage(app_data_dir: &Path, journal: &RotationJournal) -> Result<PathBuf, String> {
    let serialized = serde_json::to_vec(journal)
        .map_err(|error| format!("failed to serialize rotation journal: {error}"))?;
    if serialized.len() > MAX_JOURNAL_BYTES {
        return Err("rotation journal is too large".to_string());
    }
    write_random_restricted(&path(app_data_dir), "journal", &serialized)
}

pub(super) fn install_staged(app_data_dir: &Path, staged: &Path) -> Result<(), String> {
    replace_staged(staged, &path(app_data_dir))
}

pub(super) fn read(app_data_dir: &Path) -> Result<Option<RotationJournal>, String> {
    let live_path = path(app_data_dir);
    let live = read_candidate(&live_path)?;
    if let Some(Ok(journal)) = &live {
        return Ok(Some(journal.clone()));
    }

    let staged_paths = staged_paths(app_data_dir)?;
    let mut valid_staged = None;
    let mut staged_error = None;
    for staged_path in staged_paths {
        match read_candidate(&staged_path)? {
            Some(Ok(journal)) if valid_staged.is_none() => {
                valid_staged = Some((staged_path, journal));
            }
            Some(Ok(_)) => {
                return Err("multiple valid staged rotation journals found".to_string());
            }
            Some(Err(error)) => staged_error = Some(error),
            None => {}
        }
    }
    if let Some((staged_path, journal)) = valid_staged {
        install_staged(app_data_dir, &staged_path)?;
        return Ok(Some(journal));
    }

    match live {
        Some(Err(error)) => Err(format!("failed to parse pending rotation journal: {error}")),
        None => match staged_error {
            Some(error) => Err(format!("failed to parse staged rotation journal: {error}")),
            None => Ok(None),
        },
        Some(Ok(_)) => unreachable!(),
    }
}

pub(super) fn live_matches(
    app_data_dir: &Path,
    expected: &RotationJournal,
) -> Result<bool, String> {
    match read_candidate(&path(app_data_dir))? {
        Some(Ok(journal)) => Ok(journal == *expected),
        Some(Err(error)) => Err(format!("failed to parse pending rotation journal: {error}")),
        None => Ok(false),
    }
}

pub(super) fn cleanup(app_data_dir: &Path, failpoint: CleanupFailpoint) -> Result<(), String> {
    let journal_path = path(app_data_dir);
    cleanup_file_artifacts(&journal_path)?;
    if failpoint == CleanupFailpoint::DuringJournalUnlink {
        return Err("simulated failure during journal unlink".to_string());
    }

    let removed = remove_if_exists_without_sync(&journal_path)?;
    if removed && failpoint == CleanupFailpoint::AfterJournalUnlinkBeforeParentSync {
        return Ok(());
    }
    if removed {
        sync_parent(&journal_path)?;
    }
    Ok(())
}

pub(super) fn path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(JOURNAL_NAME)
}

fn staged_paths(app_data_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let prefix = format!("{JOURNAL_NAME}.rotation.journal.");
    let mut paths = Vec::new();
    match fs::read_dir(app_data_dir) {
        Ok(entries) => {
            for entry in entries {
                let entry =
                    entry.map_err(|error| format!("failed to inspect staged journals: {error}"))?;
                if entry.file_name().to_string_lossy().starts_with(&prefix) {
                    reject_link_or_reparse_point(&entry.path())?;
                    paths.push(entry.path());
                }
            }
        }
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => {
            return Err(format!(
                "failed to inspect application data directory: {error}"
            ));
        }
    }
    paths.sort();
    Ok(paths)
}

fn read_candidate(
    candidate: &Path,
) -> Result<Option<Result<RotationJournal, serde_json::Error>>, String> {
    reject_link_or_reparse_point(candidate)?;
    let mut file = match open_read_no_follow(candidate) {
        Ok(file) => file,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!("failed to read {}: {error}", candidate.display()));
        }
    };
    let length = file
        .metadata()
        .map_err(|error| format!("failed to inspect {}: {error}", candidate.display()))?
        .len();
    if length > MAX_JOURNAL_BYTES as u64 {
        return Err(format!(
            "rotation journal is too large: {}",
            candidate.display()
        ));
    }
    let mut data = Vec::with_capacity(length as usize);
    file.read_to_end(&mut data)
        .map_err(|error| format!("failed to read {}: {error}", candidate.display()))?;
    Ok(Some(serde_json::from_slice(&data)))
}

fn open_read_no_follow(path: &Path) -> Result<File, std::io::Error> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW);
    }
    options.open(path)
}
