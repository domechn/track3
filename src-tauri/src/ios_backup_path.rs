use std::path::{Path, PathBuf};

pub fn backup_parent(selected: &Path) -> Option<PathBuf> {
    if selected
        .file_name()
        .is_some_and(|name| name == "track3-backup")
    {
        selected.parent().map(Path::to_path_buf)
    } else if selected
        .parent()
        .and_then(Path::file_name)
        .is_some_and(|name| name == "track3-backup")
    {
        selected
            .parent()
            .and_then(Path::parent)
            .map(Path::to_path_buf)
    } else {
        None
    }
}

pub fn backup_folder_kind(kind: &str) -> Result<i32, &'static str> {
    match kind {
        "auto" => Ok(0),
        "import" => Ok(1),
        _ => Err("Invalid backup folder kind"),
    }
}
