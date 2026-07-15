use std::{fs, path::Path};

use sqlx::Connection;

use crate::ent::Ent;

use super::{
    database,
    files::{
        canonical_sessions_dir, read_optional_string, reject_link_or_reparse_point, session_path,
        validate_session_file_name, KEY_FILE_NAME,
    },
    journal::{ConfigurationRotation, RotationJournal, RotationPhase, SessionRotation},
};

pub(super) async fn prepare(
    database_path: &Path,
    app_data_dir: &Path,
    ent: &Ent,
    new_key: String,
) -> Result<RotationJournal, String> {
    let old_key = ent
        .current_key()
        .map_err(|error| format!("encryption key preflight failed: {error}"))?;
    let key_path = app_data_dir.join(KEY_FILE_NAME);
    let persisted_key = read_optional_string(&key_path)
        .map_err(|error| format!("encryption key preflight failed: {error}"))?;
    let key_file_existed = persisted_key.is_some();
    if persisted_key
        .as_deref()
        .is_some_and(|key| key.trim() != old_key)
    {
        return Err(
            "encryption key preflight failed: active and persisted keys differ".to_string(),
        );
    }

    let rows = database::load_encrypted_rows(database_path).await?;
    let mut configurations = Vec::with_capacity(rows.len());
    for (id, old_ciphertext) in rows {
        let plaintext = ent
            .decrypt_with_key(old_ciphertext.clone(), &old_key)
            .map_err(|_| format!("configuration preflight decryption failed for row {id}"))?;
        let new_ciphertext = ent
            .encrypt_with_key(plaintext.clone(), &new_key)
            .map_err(|_| format!("configuration preflight encryption failed for row {id}"))?;
        let verified = ent
            .decrypt_with_key(new_ciphertext.clone(), &new_key)
            .map_err(|_| format!("configuration preflight verification failed for row {id}"))?;
        if verified != plaintext {
            return Err(format!(
                "configuration preflight verification failed for row {id}"
            ));
        }
        configurations.push(ConfigurationRotation {
            id,
            old_ciphertext,
            new_ciphertext,
        });
    }

    let mut session_paths = Vec::new();
    let sessions_dir = canonical_sessions_dir(app_data_dir)?;
    match sessions_dir.as_deref().map(fs::read_dir).transpose() {
        Ok(Some(entries)) => {
            for entry in entries {
                let entry = entry
                    .map_err(|error| format!("session preflight directory read failed: {error}"))?;
                let file_name = entry.file_name().into_string().map_err(|_| {
                    "session preflight failed: file name is not valid UTF-8".to_string()
                })?;
                let path = entry.path();
                if file_name.contains(".json.ent.") || file_name.contains(".rotation.") {
                    return Err(format!(
                        "session preflight found an unsafe session artifact: {file_name}"
                    ));
                }
                if file_name.ends_with(".json.ent") {
                    validate_session_file_name(&file_name).map_err(|_| {
                        format!("session preflight found an invalid session file name: {file_name}")
                    })?;
                    reject_link_or_reparse_point(&path)?;
                    let metadata = fs::symlink_metadata(&path).map_err(|error| {
                        format!("session preflight metadata failed for {file_name}: {error}")
                    })?;
                    if !metadata.is_file() {
                        return Err(format!(
                            "session preflight found a non-regular session file: {file_name}"
                        ));
                    }
                    session_paths.push((file_name, path));
                    continue;
                }

                reject_link_or_reparse_point(&path)?;
                if !entry
                    .file_type()
                    .map_err(|error| format!("session preflight metadata failed: {error}"))?
                    .is_file()
                {
                    return Err(format!(
                        "session preflight found a non-regular entry: {file_name}"
                    ));
                }
            }
        }
        Ok(None) => {}
        Err(error) => {
            return Err(format!("session preflight directory open failed: {error}"));
        }
    }
    session_paths.sort_by(|left, right| left.0.cmp(&right.0));

    let mut sessions = Vec::with_capacity(session_paths.len());
    for (file_name, path) in session_paths {
        let old_ciphertext = read_optional_string(&path)?
            .ok_or_else(|| format!("session preflight file disappeared: {file_name}"))?;
        let plaintext = ent
            .decrypt_with_key(old_ciphertext.clone(), &old_key)
            .map_err(|_| format!("session preflight decryption failed for {file_name}"))?;
        let new_ciphertext = ent
            .encrypt_with_key(plaintext.clone(), &new_key)
            .map_err(|_| format!("session preflight encryption failed for {file_name}"))?;
        let verified = ent
            .decrypt_with_key(new_ciphertext.clone(), &new_key)
            .map_err(|_| format!("session preflight verification failed for {file_name}"))?;
        if verified != plaintext {
            return Err(format!(
                "session preflight verification failed for {file_name}"
            ));
        }
        sessions.push(SessionRotation {
            file_name,
            old_ciphertext,
            new_ciphertext,
        });
    }

    Ok(RotationJournal {
        phase: RotationPhase::Prepared,
        old_key,
        new_key,
        key_file_existed,
        configurations,
        sessions,
    })
}

pub(super) async fn verify_new_ciphertext(
    database_path: &Path,
    app_data_dir: &Path,
    ent: &Ent,
    journal: &RotationJournal,
) -> Result<(), String> {
    let mut connection = database::open(database_path).await?;
    for configuration in &journal.configurations {
        let current = database::current_configuration_value(&mut connection, configuration.id)
            .await?
            .ok_or_else(|| {
                format!(
                    "configuration row {} disappeared during verification",
                    configuration.id
                )
            })?;
        if current != configuration.new_ciphertext
            || ent.decrypt_with_key(current, &journal.new_key).is_err()
        {
            return Err(format!(
                "configuration verification failed for row {}",
                configuration.id
            ));
        }
    }
    connection
        .close()
        .await
        .map_err(|error| format!("configuration verification close failed: {error}"))?;

    for session in &journal.sessions {
        let path = session_path(app_data_dir, &session.file_name)?;
        let current = read_optional_string(&path)?
            .ok_or_else(|| "session verification file disappeared".to_string())?;
        if current != session.new_ciphertext
            || ent.decrypt_with_key(current, &journal.new_key).is_err()
        {
            return Err(format!(
                "session verification failed for {}",
                session.file_name
            ));
        }
    }
    Ok(())
}
