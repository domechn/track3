use std::{
    fs::{self, File, OpenOptions},
    io::{ErrorKind, Read},
    path::Path,
};

use fs2::FileExt;

pub const LEGACY_ENCRYPTION_KEY: &str = "#t.3eis@hck,btr!a";
const INSTANCE_LOCK_NAME: &str = ".track3-instance.lock";
const MAX_ENCRYPTION_KEY_BYTES: usize = 4096;

#[derive(Debug)]
pub struct AppInstanceLock {
    file: File,
}

impl Drop for AppInstanceLock {
    fn drop(&mut self) {
        let _ = FileExt::unlock(&self.file);
    }
}

pub fn acquire_app_instance_lock(app_data_dir: &Path) -> Result<AppInstanceLock, String> {
    fs::create_dir_all(app_data_dir).map_err(|error| {
        format!(
            "failed to create application data directory {}: {error}",
            app_data_dir.display()
        )
    })?;
    let lock_path = app_data_dir.join(INSTANCE_LOCK_NAME);
    reject_link_or_reparse_point(&lock_path)?;

    let mut options = OpenOptions::new();
    options.create(true).read(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW).mode(0o600);
    }
    let file = options
        .open(&lock_path)
        .map_err(|error| format!("failed to open app instance lock: {error}"))?;
    if !file
        .metadata()
        .map_err(|error| format!("failed to inspect app instance lock: {error}"))?
        .is_file()
    {
        return Err("app instance lock is not a regular file".to_string());
    }
    file.try_lock_exclusive().map_err(|error| {
        format!("Track3 is already running or its instance lock is unavailable: {error}")
    })?;
    Ok(AppInstanceLock { file })
}

pub fn load_encryption_key(key_path: &Path) -> Result<String, String> {
    let file = match open_key_file_no_follow(key_path) {
        Ok(file) => file,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            return Ok(LEGACY_ENCRYPTION_KEY.to_string());
        }
        #[cfg(unix)]
        Err(error) if error.raw_os_error() == Some(libc::ELOOP) => {
            return Err(format!("refusing symbolic link {}", key_path.display()));
        }
        Err(error) => {
            return Err(format!(
                "failed to read encryption key {}: {error}",
                key_path.display()
            ));
        }
    };
    let metadata = file
        .metadata()
        .map_err(|error| format!("failed to inspect encryption key: {error}"))?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;

        if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return Err(format!("refusing reparse point {}", key_path.display()));
        }
    }
    if !metadata.is_file() {
        return Err(format!(
            "encryption key {} is not a regular file",
            key_path.display()
        ));
    }

    let mut bytes = Vec::with_capacity(MAX_ENCRYPTION_KEY_BYTES + 1);
    file.take((MAX_ENCRYPTION_KEY_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| {
            format!(
                "failed to read encryption key {}: {error}",
                key_path.display()
            )
        })?;
    if bytes.len() > MAX_ENCRYPTION_KEY_BYTES {
        return Err(format!(
            "encryption key must not exceed {MAX_ENCRYPTION_KEY_BYTES} bytes"
        ));
    }
    let key = match String::from_utf8(bytes) {
        Ok(key) => key.trim().to_string(),
        Err(error) => {
            return Err(format!(
                "failed to read encryption key {}: {error}",
                key_path.display()
            ));
        }
    };
    validate_encryption_key_material(&key)?;
    Ok(key)
}

fn open_key_file_no_follow(key_path: &Path) -> Result<File, std::io::Error> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(windows_key_open_flags());
    }
    options.open(key_path)
}

#[cfg(any(windows, test))]
fn windows_key_open_flags() -> u32 {
    #[cfg(windows)]
    {
        windows_sys::Win32::Storage::FileSystem::FILE_FLAG_OPEN_REPARSE_POINT
    }
    #[cfg(not(windows))]
    {
        0x0020_0000
    }
}

pub(crate) fn validate_encryption_key_material(key: &str) -> Result<(), String> {
    if key.is_empty() {
        return Err("encryption key must not be empty".to_string());
    }
    if key.len() > MAX_ENCRYPTION_KEY_BYTES {
        return Err(format!(
            "encryption key must not exceed {MAX_ENCRYPTION_KEY_BYTES} bytes"
        ));
    }
    if key.chars().any(char::is_control) {
        return Err("encryption key must not contain control characters".to_string());
    }
    Ok(())
}

fn reject_link_or_reparse_point(path: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!("failed to inspect {}: {error}", path.display()));
        }
    };

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

#[cfg(test)]
mod tests {
    use std::fs;

    use uuid::Uuid;

    use super::{
        acquire_app_instance_lock, load_encryption_key, windows_key_open_flags,
        LEGACY_ENCRYPTION_KEY,
    };

    struct TestDirectory(std::path::PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("track3-startup-security-{}", Uuid::new_v4()));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn app_instance_lock_rejects_a_second_holder_and_releases_on_drop() {
        let directory = TestDirectory::new();
        let first = acquire_app_instance_lock(&directory.0).unwrap();

        let error = acquire_app_instance_lock(&directory.0).unwrap_err();
        assert!(error.contains("already running"));

        drop(first);
        acquire_app_instance_lock(&directory.0).unwrap();
    }

    #[test]
    fn existing_key_file_is_trimmed_for_legacy_newline_compatibility() {
        let directory = TestDirectory::new();
        let key_path = directory.0.join(".ent-key");
        fs::write(&key_path, "legacy-custom-key\r\n").unwrap();

        assert_eq!(load_encryption_key(&key_path).unwrap(), "legacy-custom-key");
    }

    #[test]
    fn missing_key_file_uses_the_legacy_key() {
        let directory = TestDirectory::new();

        assert_eq!(
            load_encryption_key(&directory.0.join(".ent-key")).unwrap(),
            LEGACY_ENCRYPTION_KEY
        );
    }

    #[test]
    fn windows_key_open_policy_inspects_the_reparse_point_itself() {
        assert_eq!(windows_key_open_flags(), 0x0020_0000);
    }

    #[test]
    fn persisted_keys_reject_control_characters_and_excessive_length() {
        let directory = TestDirectory::new();
        let key_path = directory.0.join(".ent-key");
        fs::write(&key_path, "control\u{0007}key").unwrap();
        assert!(load_encryption_key(&key_path)
            .unwrap_err()
            .contains("control characters"));

        fs::write(&key_path, "x".repeat(4097)).unwrap();
        assert!(load_encryption_key(&key_path)
            .unwrap_err()
            .contains("4096 bytes"));
    }

    #[test]
    fn oversized_key_is_rejected_after_a_bounded_read_before_utf8_decoding() {
        let directory = TestDirectory::new();
        let key_path = directory.0.join(".ent-key");
        let mut oversized = vec![b'x'; 4097];
        oversized.push(0xff);
        fs::write(&key_path, oversized).unwrap();

        let error = load_encryption_key(&key_path).unwrap_err();

        assert!(error.contains("4096 bytes"), "{error}");
        assert!(!error.contains("UTF-8"), "{error}");
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_key_file_is_rejected_without_reading_its_target() {
        use std::os::unix::fs::symlink;

        let directory = TestDirectory::new();
        let outside_key = directory.0.join("outside-key");
        let key_path = directory.0.join(".ent-key");
        fs::write(&outside_key, "outside-secret-key").unwrap();
        symlink(&outside_key, &key_path).unwrap();

        let error = load_encryption_key(&key_path).unwrap_err();

        assert!(error.contains("symbolic link"), "{error}");
        assert_eq!(
            fs::read_to_string(outside_key).unwrap(),
            "outside-secret-key"
        );
    }
}
