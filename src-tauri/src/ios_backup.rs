use std::{fs, path::Path};

use objc2_foundation::{NSNumber, NSString, NSURLIsExcludedFromBackupKey, NSURL};

pub fn exclude_key_artifact(path: &Path) -> Result<(), String> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    if !name.starts_with(".ent-key") {
        return Ok(());
    }
    let text = NSString::from_str(
        path.to_str()
            .ok_or_else(|| "invalid encryption key path".to_string())?,
    );
    let url = NSURL::fileURLWithPath(&text);
    let excluded = NSNumber::numberWithBool(true);
    // NSURLIsExcludedFromBackupKey requires an NSNumber boolean value.
    unsafe { url.setResourceValue_forKey_error(Some(&excluded), NSURLIsExcludedFromBackupKey) }
        .map_err(|_| format!("failed to exclude {} from device backups", path.display()))
}

pub fn exclude_existing_key_artifacts(directory: &Path) -> Result<(), String> {
    for entry in fs::read_dir(directory).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().map_err(|e| e.to_string())?.is_file() {
            exclude_key_artifact(&entry.path())?;
        }
    }
    Ok(())
}
