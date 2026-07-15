use std::{
    fs::{self, File, OpenOptions},
    io::{ErrorKind, Read, Write},
    path::{Path, PathBuf},
};

use uuid::Uuid;

use super::ExecutionError;

pub(super) const BACKUP_SUFFIX: &str = ".rotation.bak";
pub(super) const KEY_FILE_NAME: &str = ".ent-key";
const ROTATION_ARTIFACT_MARKER: &str = ".rotation.";

#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) enum ReplacementStrategy {
    RenameAbsent,
    AtomicReplaceExisting,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) enum FileInstallFailpoint {
    None,
    CrashDuringBackupStaging,
    CrashAfterBackupInstalled,
    OperationalAfterBackupInstalled,
}

pub(super) fn install_contents(
    target: &Path,
    old_contents: &str,
    new_contents: &str,
    failpoint: FileInstallFailpoint,
) -> Result<(), ExecutionError> {
    ensure_backup(target, old_contents, new_contents, failpoint)?;

    match failpoint {
        FileInstallFailpoint::CrashAfterBackupInstalled => {
            return Err(ExecutionError::crash(
                "simulated crash after backup installation",
            ));
        }
        FileInstallFailpoint::OperationalAfterBackupInstalled => {
            return Err(ExecutionError::operational(
                "simulated failure during file replacement",
            ));
        }
        FileInstallFailpoint::None | FileInstallFailpoint::CrashDuringBackupStaging => {}
    }

    install_replacement(target, old_contents, new_contents).map_err(ExecutionError::operational)
}

pub(super) fn install_key_contents(
    target: &Path,
    old_existed: bool,
    old_contents: &str,
    new_contents: &str,
) -> Result<(), String> {
    if old_existed {
        normalize_legacy_key_file(target, old_contents, new_contents)?;
        return install_contents(
            target,
            old_contents,
            new_contents,
            FileInstallFailpoint::None,
        )
        .map_err(ExecutionError::into_message);
    }

    let current = read_optional_string(target)?;
    if current.as_deref() == Some(new_contents) {
        cleanup_random_stages(target)?;
        return Ok(());
    }
    if current.is_some() {
        return Err("unexpected encryption key file appeared during rotation".to_string());
    }

    let staged = write_random_restricted(target, "replacement", new_contents.as_bytes())?;
    replace_staged(&staged, target)?;
    verify_contents(target, new_contents, "persisted encryption key")
}

fn normalize_legacy_key_file(target: &Path, old_key: &str, new_key: &str) -> Result<(), String> {
    let Some(current) = read_optional_string(target)? else {
        return Ok(());
    };
    if current == old_key || current == new_key {
        return Ok(());
    }
    if current.trim() != old_key {
        return Err("persisted encryption key changed unexpectedly".to_string());
    }

    let staged = write_random_restricted(target, "normalization", old_key.as_bytes())?;
    replace_staged(&staged, target)
}

pub(super) fn restore_contents(
    target: &Path,
    old_contents: &str,
    new_contents: &str,
) -> Result<(), String> {
    let current = read_optional_string(target)?;
    if current.as_deref() == Some(old_contents) {
        cleanup_file_artifacts(target)?;
        return Ok(());
    }
    if current.as_deref() != Some(new_contents) && current.is_some() {
        return Err(format!(
            "rotation target changed unexpectedly: {}",
            target.display()
        ));
    }

    let backup_path = sibling_with_suffix(target, BACKUP_SUFFIX);
    if read_optional_string(&backup_path)?.as_deref() != Some(old_contents) {
        let staged = write_random_restricted(target, "backup", old_contents.as_bytes())?;
        replace_staged(&staged, &backup_path)?;
    }

    let staged = write_random_restricted(target, "replacement", old_contents.as_bytes())?;
    replace_staged(&staged, target)?;
    verify_contents(target, old_contents, "restored file")?;
    cleanup_file_artifacts(target)
}

pub(super) fn cleanup_file_artifacts(target: &Path) -> Result<(), String> {
    for path in rotation_artifact_paths(target)? {
        remove_if_exists(&path)?;
    }
    Ok(())
}

fn cleanup_random_stages(target: &Path) -> Result<(), String> {
    let backup_path = sibling_with_suffix(target, BACKUP_SUFFIX);
    for path in rotation_artifact_paths(target)? {
        if path != backup_path {
            remove_if_exists(&path)?;
        }
    }
    Ok(())
}

fn rotation_artifact_paths(target: &Path) -> Result<Vec<PathBuf>, String> {
    let parent = target
        .parent()
        .ok_or_else(|| format!("path has no parent: {}", target.display()))?;
    let target_name = target
        .file_name()
        .ok_or_else(|| format!("path has no file name: {}", target.display()))?
        .to_string_lossy();
    let prefix = format!("{target_name}{ROTATION_ARTIFACT_MARKER}");
    let mut paths = Vec::new();
    match fs::read_dir(parent) {
        Ok(entries) => {
            for entry in entries {
                let entry = entry
                    .map_err(|error| format!("failed to inspect rotation artifacts: {error}"))?;
                if entry.file_name().to_string_lossy().starts_with(&prefix) {
                    reject_link_or_reparse_point(&entry.path())?;
                    paths.push(entry.path());
                }
            }
        }
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => {
            return Err(format!(
                "failed to inspect directory {}: {error}",
                parent.display()
            ));
        }
    }
    paths.sort();
    Ok(paths)
}

fn ensure_backup(
    target: &Path,
    old_contents: &str,
    new_contents: &str,
    failpoint: FileInstallFailpoint,
) -> Result<(), ExecutionError> {
    let current = read_optional_string(target).map_err(ExecutionError::operational)?;
    if current.as_deref() != Some(old_contents)
        && current.as_deref() != Some(new_contents)
        && current.is_some()
    {
        return Err(ExecutionError::operational(format!(
            "rotation target changed unexpectedly: {}",
            target.display()
        )));
    }

    let backup_path = sibling_with_suffix(target, BACKUP_SUFFIX);
    if read_optional_string(&backup_path)
        .map_err(ExecutionError::operational)?
        .as_deref()
        == Some(old_contents)
    {
        cleanup_random_stages(target).map_err(ExecutionError::operational)?;
        return Ok(());
    }

    let backup_contents = if failpoint == FileInstallFailpoint::CrashDuringBackupStaging {
        let split = old_contents.len().saturating_div(2).max(1);
        &old_contents.as_bytes()[..split]
    } else {
        old_contents.as_bytes()
    };
    let staged = write_random_restricted(target, "backup", backup_contents)
        .map_err(ExecutionError::operational)?;
    if failpoint == FileInstallFailpoint::CrashDuringBackupStaging {
        return Err(ExecutionError::crash(
            "simulated crash during backup staging",
        ));
    }
    replace_staged(&staged, &backup_path).map_err(ExecutionError::operational)?;

    if read_optional_string(&backup_path)
        .map_err(ExecutionError::operational)?
        .as_deref()
        != Some(old_contents)
    {
        return Err(ExecutionError::operational(format!(
            "rotation backup verification failed: {}",
            target.display()
        )));
    }
    cleanup_random_stages(target).map_err(ExecutionError::operational)
}

fn install_replacement(
    target: &Path,
    old_contents: &str,
    new_contents: &str,
) -> Result<(), String> {
    let current = read_optional_string(target)?;
    if current.as_deref() == Some(new_contents) {
        cleanup_random_stages(target)?;
        return Ok(());
    }
    if current.as_deref() != Some(old_contents) && current.is_some() {
        return Err(format!(
            "rotation target changed unexpectedly: {}",
            target.display()
        ));
    }

    let staged = write_random_restricted(target, "replacement", new_contents.as_bytes())?;
    replace_staged(&staged, target)?;
    verify_contents(target, new_contents, "rotated file")
}

fn verify_contents(target: &Path, expected: &str, label: &str) -> Result<(), String> {
    if read_optional_string(target)?.as_deref() != Some(expected) {
        return Err(format!("{label} verification failed: {}", target.display()));
    }
    Ok(())
}

pub(super) fn replacement_strategy(target_exists: bool) -> ReplacementStrategy {
    if target_exists {
        ReplacementStrategy::AtomicReplaceExisting
    } else {
        ReplacementStrategy::RenameAbsent
    }
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn windows_move_flags(target_exists: bool) -> u32 {
    const MOVEFILE_REPLACE_EXISTING_FLAG: u32 = 0x1;
    const MOVEFILE_WRITE_THROUGH_FLAG: u32 = 0x8;

    MOVEFILE_WRITE_THROUGH_FLAG
        | if target_exists {
            MOVEFILE_REPLACE_EXISTING_FLAG
        } else {
            0
        }
}

pub(super) fn replace_staged(staged: &Path, target: &Path) -> Result<(), String> {
    replace_staged_with_parent_sync_failpoint(staged, target, false)
}

pub(super) fn replace_staged_with_parent_sync_failpoint(
    staged: &Path,
    target: &Path,
    fail_parent_sync: bool,
) -> Result<(), String> {
    ensure_regular_file(staged)?;
    reject_link_or_reparse_point(target)?;
    let target_exists = path_exists(target)?;
    replace_staged_platform(staged, target, target_exists)?;
    if fail_parent_sync {
        return Err("simulated parent directory sync failure after atomic install".to_string());
    }
    sync_parent(target)
}

#[cfg(windows)]
fn replace_staged_platform(
    staged: &Path,
    target: &Path,
    target_exists: bool,
) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::MoveFileExW;

    let target_wide = target
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let staged_wide = staged
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let result = unsafe {
        MoveFileExW(
            staged_wide.as_ptr(),
            target_wide.as_ptr(),
            windows_move_flags(target_exists),
        )
    };
    if result == 0 {
        return Err(format!(
            "failed to install {} with write-through: {}",
            target.display(),
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(not(windows))]
fn replace_staged_platform(
    staged: &Path,
    target: &Path,
    target_exists: bool,
) -> Result<(), String> {
    match replacement_strategy(target_exists) {
        ReplacementStrategy::RenameAbsent => fs::rename(staged, target)
            .map_err(|error| format!("failed to install {}: {error}", target.display())),
        ReplacementStrategy::AtomicReplaceExisting => fs::rename(staged, target)
            .map_err(|error| format!("failed to replace {}: {error}", target.display())),
    }
}

pub(super) fn write_random_restricted(
    target: &Path,
    purpose: &str,
    data: &[u8],
) -> Result<PathBuf, String> {
    let parent = target
        .parent()
        .ok_or_else(|| format!("path has no parent: {}", target.display()))?;
    let target_name = target
        .file_name()
        .ok_or_else(|| format!("path has no file name: {}", target.display()))?
        .to_string_lossy();

    for _ in 0..16 {
        let path = parent.join(format!(
            "{target_name}{ROTATION_ARTIFACT_MARKER}{purpose}.{}.tmp",
            Uuid::new_v4()
        ));
        match write_restricted_new(&path, data) {
            Ok(()) => return Ok(path),
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!("failed to stage {}: {error}", target.display()));
            }
        }
    }
    Err(format!(
        "failed to allocate a unique staging file for {}",
        target.display()
    ))
}

fn write_restricted_new(path: &Path, data: &[u8]) -> Result<(), std::io::Error> {
    let mut options = OpenOptions::new();
    options.create_new(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW).mode(0o600);
    }
    let mut file = options.open(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(fs::Permissions::from_mode(0o600))?;
    }
    file.write_all(data)?;
    file.flush()?;
    file.sync_all()?;
    sync_parent(path).map_err(std::io::Error::other)
}

pub(super) fn read_optional_string(path: &Path) -> Result<Option<String>, String> {
    reject_link_or_reparse_point(path)?;
    let mut file = match open_read_no_follow(path) {
        Ok(file) => file,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!("failed to read {}: {error}", path.display()));
        }
    };
    if !file
        .metadata()
        .map_err(|error| format!("failed to inspect {}: {error}", path.display()))?
        .is_file()
    {
        return Err(format!(
            "rotation target is not a regular file: {}",
            path.display()
        ));
    }
    let mut value = String::new();
    file.read_to_string(&mut value)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    Ok(Some(value))
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

pub(super) fn remove_if_exists(path: &Path) -> Result<(), String> {
    if remove_if_exists_without_sync(path)? {
        sync_parent(path)?;
    }
    Ok(())
}

pub(super) fn remove_if_exists_without_sync(path: &Path) -> Result<bool, String> {
    reject_link_or_reparse_point(path)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(true),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!("failed to remove {}: {error}", path.display())),
    }
}

pub(super) fn sibling_with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut path = path.as_os_str().to_os_string();
    path.push(suffix);
    PathBuf::from(path)
}

#[cfg(unix)]
pub(super) fn sync_parent(path: &Path) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("path has no parent: {}", path.display()))?;
    reject_link_or_reparse_point(parent)?;
    let directory = fs::File::open(parent)
        .map_err(|error| format!("failed to open directory {}: {error}", parent.display()))?;
    directory
        .sync_all()
        .map_err(|error| format!("failed to sync directory {}: {error}", parent.display()))
}

#[cfg(not(unix))]
pub(super) fn sync_parent(_path: &Path) -> Result<(), String> {
    Ok(())
}

pub(super) fn canonical_sessions_dir(app_data_dir: &Path) -> Result<Option<PathBuf>, String> {
    let canonical_app_data = fs::canonicalize(app_data_dir).map_err(|error| {
        format!(
            "failed to canonicalize application data directory {}: {error}",
            app_data_dir.display()
        )
    })?;
    let sessions_dir = app_data_dir.join("ai/sessions");
    let metadata = match fs::symlink_metadata(&sessions_dir) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "session preflight metadata failed for {}: {error}",
                sessions_dir.display()
            ));
        }
    };
    reject_metadata_link_or_reparse_point(&metadata, &sessions_dir)?;
    if !metadata.is_dir() {
        return Err("session preflight path is not a directory".to_string());
    }
    let canonical_sessions = fs::canonicalize(&sessions_dir).map_err(|error| {
        format!(
            "failed to canonicalize session directory {}: {error}",
            sessions_dir.display()
        )
    })?;
    if !canonical_sessions.starts_with(&canonical_app_data) {
        return Err("session directory escapes the application data directory".to_string());
    }
    Ok(Some(canonical_sessions))
}

pub(super) fn session_path(app_data_dir: &Path, file_name: &str) -> Result<PathBuf, String> {
    validate_session_file_name(file_name)?;
    let sessions_dir = canonical_sessions_dir(app_data_dir)?
        .ok_or_else(|| "session directory is missing during rotation".to_string())?;
    let path = sessions_dir.join(file_name);
    reject_link_or_reparse_point(&path)?;
    if path_exists(&path)? {
        let canonical_path = fs::canonicalize(&path).map_err(|error| {
            format!(
                "failed to canonicalize session file {}: {error}",
                path.display()
            )
        })?;
        if !canonical_path.starts_with(&sessions_dir) {
            return Err("session file escapes the application data directory".to_string());
        }
    }
    Ok(path)
}

pub(super) fn validate_session_file_name(file_name: &str) -> Result<(), String> {
    let Some(uuid_text) = file_name.strip_suffix(".json.ent") else {
        return Err("rotation journal contains an invalid session file name".to_string());
    };
    let parsed = Uuid::parse_str(uuid_text)
        .map_err(|_| "rotation journal contains an invalid session file name".to_string())?;
    let path = Path::new(file_name);
    if parsed.hyphenated().to_string() != uuid_text
        || path
            .parent()
            .is_some_and(|parent| !parent.as_os_str().is_empty())
        || file_name.chars().any(char::is_control)
    {
        return Err("rotation journal contains an invalid session file name".to_string());
    }
    Ok(())
}

pub(super) fn reject_link_or_reparse_point(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => reject_metadata_link_or_reparse_point(&metadata, path),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("failed to inspect {}: {error}", path.display())),
    }
}

fn reject_metadata_link_or_reparse_point(
    metadata: &fs::Metadata,
    path: &Path,
) -> Result<(), String> {
    #[cfg(unix)]
    if metadata.file_type().is_symlink() {
        return Err(format!("refusing symbolic link {}", path.display()));
    }

    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;

        if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return Err(format!("refusing reparse point {}", path.display()));
        }
    }

    Ok(())
}

fn ensure_regular_file(path: &Path) -> Result<(), String> {
    reject_link_or_reparse_point(path)?;
    if !fs::symlink_metadata(path)
        .map_err(|error| format!("failed to inspect {}: {error}", path.display()))?
        .is_file()
    {
        return Err(format!(
            "rotation staging path is not a regular file: {}",
            path.display()
        ));
    }
    Ok(())
}

fn path_exists(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!("failed to inspect {}: {error}", path.display())),
    }
}
