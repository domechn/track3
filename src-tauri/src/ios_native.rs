use std::{ffi::CString, path::Path};

use tauri::Manager;

unsafe extern "C" {
    fn track3_ios_install_native();
    fn track3_ios_lock_enabled() -> bool;
    fn track3_ios_set_lock_enabled(enabled: bool);
    fn track3_ios_authenticate() -> bool;
    fn track3_ios_haptic(kind: u8);
    fn track3_ios_set_badge(count: i32);
    fn track3_ios_share_file(path: *const std::ffi::c_char) -> bool;
    fn track3_ios_keychain_read(output: *mut u8, capacity: i32) -> i32;
    fn track3_ios_keychain_write(input: *const u8, length: i32) -> i32;
    fn track3_ios_keychain_delete() -> bool;
}

pub fn keychain_read() -> Result<Option<String>, String> {
    let mut bytes = [0u8; 4096];
    let length = unsafe { track3_ios_keychain_read(bytes.as_mut_ptr(), bytes.len() as i32) };
    match length {
        -1 => Ok(None),
        -2 => Err("iOS Keychain returned invalid key data".into()),
        0.. => String::from_utf8(bytes[..length as usize].to_vec())
            .map(Some)
            .map_err(|_| "invalid iOS Keychain key".into()),
        status => Err(format!("iOS Keychain read failed (OSStatus {status})")),
    }
}

pub fn keychain_write(key: &str) -> Result<(), String> {
    let status = unsafe { track3_ios_keychain_write(key.as_ptr(), key.len() as i32) };
    if status == 0 {
        Ok(())
    } else {
        Err(format!("iOS Keychain write failed (OSStatus {status})"))
    }
}

pub fn keychain_delete() -> Result<(), String> {
    if unsafe { track3_ios_keychain_delete() } {
        Ok(())
    } else {
        Err("iOS Keychain delete failed".into())
    }
}

pub fn install() {
    unsafe { track3_ios_install_native() }
}

pub fn lock_enabled() -> bool {
    unsafe { track3_ios_lock_enabled() }
}

pub fn set_lock_enabled(enabled: bool) {
    unsafe { track3_ios_set_lock_enabled(enabled) }
}

pub fn authenticate() -> bool {
    unsafe { track3_ios_authenticate() }
}

pub fn haptic(kind: &str) -> Result<(), String> {
    let code = match kind {
        "light" => 0,
        "success" => 1,
        "error" => 2,
        _ => return Err("invalid haptic type".into()),
    };
    unsafe { track3_ios_haptic(code) };
    Ok(())
}

pub fn set_badge(count: i32) {
    unsafe { track3_ios_set_badge(count.max(0)) }
}

pub fn share_file(handle: &tauri::AppHandle, path: &str) -> Result<(), String> {
    let source = Path::new(path)
        .canonicalize()
        .map_err(|_| "export file is unavailable")?;
    let cache = handle
        .path()
        .app_cache_dir()
        .map_err(|_| "app cache is unavailable")?
        .canonicalize()
        .map_err(|_| "app cache is unavailable")?;
    if !crate::ios_share_path::is_allowed_share_path(&source, &cache) {
        return Err("invalid export file".into());
    }
    let c_path = CString::new(source.to_string_lossy().as_bytes())
        .map_err(|_| "invalid export file path")?;
    if unsafe { track3_ios_share_file(c_path.as_ptr()) } {
        Ok(())
    } else {
        Err("could not open the share sheet".into())
    }
}
