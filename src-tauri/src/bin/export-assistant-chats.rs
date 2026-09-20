use serde::Serialize;
use sqlx::{sqlite::SqliteConnectOptions, Connection, FromRow, SqliteConnection};
use std::time::{SystemTime, UNIX_EPOCH};
use std::{
    env, fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    str::FromStr,
};
use track3::{
    ent::Ent,
    startup_security::{load_encryption_key, LEGACY_ENCRYPTION_KEY},
};

#[derive(Debug, Serialize, FromRow)]
struct SessionMeta {
    id: String,
    title: String,
    #[sqlx(rename = "createdAt")]
    created_at: String,
    #[sqlx(rename = "updatedAt")]
    updated_at: String,
    pinned: i64,
    #[sqlx(rename = "messageCount")]
    message_count: i64,
    preview: String,
}

#[derive(Debug, Serialize)]
struct SessionExport {
    meta: SessionMeta,
    session_file: String,
    payload: Option<serde_json::Value>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct ExportPayload {
    exported_at_unix_ms: u128,
    app_data_dir: String,
    database_path: String,
    session_file_dir: String,
    total_sessions: usize,
    sessions: Vec<SessionExport>,
}

fn default_app_data_dir() -> Result<PathBuf, String> {
    let home = env::var("HOME").map_err(|_| "HOME is not set".to_string())?;
    Ok(Path::new(&home)
        .join("Library")
        .join("Application Support")
        .join("dev.track3.track3"))
}

fn parse_args() -> Result<(PathBuf, PathBuf), String> {
    let mut app_data_dir: Option<PathBuf> = None;
    let mut output_path: Option<PathBuf> = None;

    let args: Vec<String> = env::args().skip(1).collect();
    let mut i = 0usize;
    while i < args.len() {
        match args[i].as_str() {
            "--app-data-dir" => {
                i += 1;
                let value = args.get(i).ok_or("missing value for --app-data-dir")?;
                app_data_dir = Some(PathBuf::from(value));
            }
            "--out" => {
                i += 1;
                let value = args.get(i).ok_or("missing value for --out")?;
                output_path = Some(PathBuf::from(value));
            }
            "--help" | "-h" => {
                return Err(
                    "Usage: export-assistant-chats [--app-data-dir <path>] --out <output.json>"
                        .to_string(),
                );
            }
            other => {
                return Err(format!("unknown argument: {other}"));
            }
        }
        i += 1;
    }

    let app_data_dir = match app_data_dir {
        Some(path) => path,
        None => default_app_data_dir()?,
    };

    let output_path = output_path.ok_or(
        "missing required --out <output.json>. Example: --out ~/Desktop/track3-assistant-full.json"
            .to_string(),
    )?;

    Ok((app_data_dir, output_path))
}

fn now_unix_ms() -> Result<u128, String> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("failed to compute current timestamp: {error}"))?;
    Ok(duration.as_millis())
}

#[tokio::main]
async fn main() -> Result<(), String> {
    let (app_data_dir, output_path) = parse_args()?;

    let database_path = app_data_dir.join("track3.db");
    let sessions_dir = app_data_dir.join("ai").join("sessions");
    let key_path = app_data_dir.join(".ent-key");

    if !database_path.exists() {
        return Err(format!("database not found: {}", database_path.display()));
    }
    if !sessions_dir.exists() {
        return Err(format!(
            "sessions directory not found: {}",
            sessions_dir.display()
        ));
    }

    let key = load_encryption_key(&key_path)?;
    let ent = Ent::new();
    ent.set_key(key)?;

    let conn_options =
        SqliteConnectOptions::from_str(&format!("sqlite:{}", database_path.display()))
            .map_err(|error| format!("failed to build sqlite options: {error}"))?;
    let mut conn = SqliteConnection::connect_with(&conn_options)
        .await
        .map_err(|error| format!("failed to open sqlite database: {error}"))?;

    let metas = sqlx::query_as::<_, SessionMeta>(
        "SELECT id, title, createdAt, updatedAt, pinned, messageCount, preview FROM chat_sessions ORDER BY pinned DESC, updatedAt DESC",
    )
    .fetch_all(&mut conn)
    .await
    .map_err(|error| format!("failed to query chat_sessions: {error}"))?;

    let mut sessions: Vec<SessionExport> = Vec::with_capacity(metas.len());

    for meta in metas {
        let session_file = sessions_dir.join(format!("{}.json.ent", meta.id));
        let mut payload: Option<serde_json::Value> = None;
        let mut error: Option<String> = None;

        match fs::read_to_string(&session_file) {
            Ok(ciphertext) => match ent.decrypt_with_fallback(ciphertext, LEGACY_ENCRYPTION_KEY) {
                Ok(plaintext) => match serde_json::from_str::<serde_json::Value>(&plaintext) {
                    Ok(json) => payload = Some(json),
                    Err(parse_error) => {
                        error = Some(format!(
                            "failed to parse decrypted session JSON: {parse_error}"
                        ))
                    }
                },
                Err(decrypt_error) => {
                    error = Some(format!("failed to decrypt session file: {decrypt_error}"))
                }
            },
            Err(read_error) if read_error.kind() == ErrorKind::NotFound => {
                error = Some("session file not found".to_string())
            }
            Err(read_error) => error = Some(format!("failed to read session file: {read_error}")),
        }

        sessions.push(SessionExport {
            meta,
            session_file: session_file.to_string_lossy().to_string(),
            payload,
            error,
        });
    }

    let export_payload = ExportPayload {
        exported_at_unix_ms: now_unix_ms()?,
        app_data_dir: app_data_dir.to_string_lossy().to_string(),
        database_path: database_path.to_string_lossy().to_string(),
        session_file_dir: sessions_dir.to_string_lossy().to_string(),
        total_sessions: sessions.len(),
        sessions,
    };

    if let Some(parent) = output_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "failed to create output directory {}: {error}",
                    parent.display()
                )
            })?;
        }
    }

    let output_json = serde_json::to_string_pretty(&export_payload)
        .map_err(|error| format!("failed to serialize output JSON: {error}"))?;
    fs::write(&output_path, output_json).map_err(|error| {
        format!(
            "failed to write output file {}: {error}",
            output_path.display()
        )
    })?;

    println!(
        "Exported {} session(s) to {}",
        export_payload.total_sessions,
        output_path.display()
    );
    Ok(())
}
