use serde::Serialize;
use sqlx::{sqlite::SqliteConnectOptions, Connection, FromRow, SqliteConnection};
use std::collections::BTreeSet;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{
    env, fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    str::FromStr,
};
use track3_lib::{
    ent::Ent,
    info::sanitize_upstream_error,
    startup_security::{load_encryption_key, LEGACY_ENCRYPTION_KEY},
};

fn redact_text(input: &str, configured: &[String]) -> String {
    let mut text = input.to_string();
    for secret in configured.iter().filter(|value| value.len() >= 4) {
        text = text.replace(secret, "<REDACTED>");
    }
    text = sanitize_upstream_error(&text);
    for prefix in ["Bearer ", "bearer ", "sk-"] {
        let mut cursor = 0;
        while let Some(offset) = text[cursor..].find(prefix) {
            let start = cursor + offset;
            let token_start = start + prefix.len();
            let end = text[start + prefix.len()..]
                .find(|ch: char| {
                    !(ch.is_ascii_alphanumeric()
                        || if prefix == "sk-" {
                            ch == '_' || ch == '-'
                        } else {
                            "._~+/-".contains(ch)
                        })
                })
                .map(|offset| start + prefix.len() + offset)
                .unwrap_or(text.len());
            if (prefix == "sk-"
                && (text[..start]
                    .chars()
                    .next_back()
                    .is_some_and(|ch| ch.is_ascii_alphanumeric())
                    || end - token_start < 12))
                || end == token_start
            {
                cursor = token_start;
                continue;
            }
            text.replace_range(start..end, "<REDACTED>");
            cursor = start + "<REDACTED>".len();
        }
    }
    redact_entropy_tokens(&text)
}

fn redact_entropy_tokens(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut output = String::with_capacity(text.len());
    let mut cursor = 0;
    let mut copied = 0;
    while cursor < bytes.len() {
        if !bytes[cursor].is_ascii_alphanumeric() && bytes[cursor] != b'+' {
            cursor += 1;
            continue;
        }
        let start = cursor;
        while cursor < bytes.len()
            && (bytes[cursor].is_ascii_alphanumeric() || matches!(bytes[cursor], b'+' | b'='))
        {
            cursor += 1;
        }
        let candidate = &bytes[start..cursor];
        let distinct = candidate
            .iter()
            .map(|byte| byte.to_ascii_lowercase())
            .collect::<BTreeSet<_>>()
            .len();
        let hex_token = candidate.iter().all(u8::is_ascii_hexdigit);
        let padding = candidate
            .iter()
            .rev()
            .take_while(|byte| **byte == b'=')
            .count();
        let padded_base64 = (1..=2).contains(&padding)
            && candidate[..candidate.len() - padding]
                .iter()
                .all(|byte| byte.is_ascii_alphanumeric() || *byte == b'+');
        if bytes.get(start.wrapping_sub(1)) != Some(&b'/')
            && candidate.len() >= 32
            && (hex_token || padded_base64)
            && distinct >= 10
            && !is_public_chain_identifier(&text[start..cursor], &text[..start])
        {
            output.push_str(&text[copied..start]);
            output.push_str("<REDACTED>");
            copied = cursor;
        }
    }
    output.push_str(&text[copied..]);
    output
}

fn is_public_chain_identifier(candidate: &str, prefix: &str) -> bool {
    let value = candidate.rsplit('/').next().unwrap_or(candidate);
    let path_label = candidate
        .rsplit_once('/')
        .and_then(|(path, _)| path.rsplit('/').next());
    let is_chain_path = matches!(path_label, Some("address" | "account" | "tx"));
    let labelled = is_chain_path
        || ["wallet", "address", "account"]
            .iter()
            .any(|label| prefix.trim_end_matches([':', '/', ' ']).ends_with(label));
    if let Some(hex) = value.strip_prefix("0x") {
        if matches!(hex.len(), 40 | 64) && hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return candidate == value || is_chain_path;
        }
    }
    if value.starts_with("bc1")
        && (14..=90).contains(&value.len())
        && value.bytes().all(|byte| byte.is_ascii_alphanumeric())
    {
        return candidate == value || is_chain_path;
    }
    (32..=88).contains(&value.len())
        && labelled
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() && !matches!(byte, b'0' | b'O' | b'I' | b'l'))
}

fn redact_json(value: &mut serde_json::Value, configured: &[String]) {
    match value {
        serde_json::Value::String(text) => *text = redact_text(text, configured),
        serde_json::Value::Array(items) => {
            for item in items {
                redact_json(item, configured);
            }
        }
        serde_json::Value::Object(fields) => {
            for (key, item) in fields {
                let key_name = key.to_ascii_lowercase().replace(['_', '-'], "");
                if [
                    "apikey",
                    "apisecret",
                    "accesskey",
                    "clientsecret",
                    "privatekey",
                    "secret",
                    "signature",
                    "token",
                    "accesstoken",
                    "refreshtoken",
                    "password",
                    "passphrase",
                    "authorization",
                    "licensekey",
                    "cloudsynckey",
                    "credential",
                    "credentials",
                ]
                .contains(&key_name.as_str())
                {
                    *item = serde_json::Value::String("<REDACTED>".to_string());
                } else {
                    redact_json(item, configured);
                }
            }
        }
        _ => {}
    }
}

async fn configured_secrets(conn: &mut SqliteConnection, ent: &Ent) -> Vec<String> {
    let rows = sqlx::query_as::<_, (i64, String)>(
        "SELECT id, data FROM configuration WHERE id IN (10, 11, 12, 20, 994, 997)",
    )
    .fetch_all(conn)
    .await
    .unwrap_or_default();
    let mut secrets = Vec::new();
    for (id, data) in rows {
        let plaintext = if data.starts_with("!ent:") {
            match ent.decrypt_with_fallback(data, LEGACY_ENCRYPTION_KEY) {
                Ok(value) => value,
                Err(_) => continue,
            }
        } else {
            data
        };
        if id == 997 {
            secrets.push(plaintext);
        } else if id == 994 {
            if let Ok(config) = serde_json::from_str::<serde_json::Value>(&plaintext) {
                if let Some(key) = config.get("apiKey").and_then(|value| value.as_str()) {
                    secrets.push(key.to_string());
                }
                if let Some(headers) = config
                    .pointer("/advanced/headers")
                    .and_then(|value| value.as_object())
                {
                    secrets.extend(
                        headers
                            .values()
                            .filter_map(|value| value.as_str().map(str::to_string)),
                    );
                }
            }
        } else {
            for line in plaintext.lines() {
                if let Some((key, value)) = line.split_once(':') {
                    let key = key.to_ascii_lowercase();
                    if ["key", "secret", "token", "password", "passphrase"]
                        .iter()
                        .any(|word| key.contains(word))
                    {
                        secrets.push(value.trim().trim_matches(['"', '\'']).to_string());
                    }
                }
            }
        }
    }
    secrets
}

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
    let secrets = configured_secrets(&mut conn, &ent).await;

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

    let mut safe_payload = serde_json::to_value(&export_payload)
        .map_err(|error| format!("failed to build output JSON: {error}"))?;
    redact_json(&mut safe_payload, &secrets);
    let output_json = serde_json::to_string_pretty(&safe_payload)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exported_payload_removes_secret_fields_and_strings() {
        let mut payload = serde_json::json!({
            "messages": [
                {"role": "user", "content": "Bearer private-token-123456"},
                {"role": "assistant", "apiKey": "custom-private-key",
                 "content": "sk-abcdefghijklmnop1234567890",
                 "accessKey": "short-access-key",
                 "clientSecret": "short-client-secret"}
            ]
        });
        redact_json(&mut payload, &["custom-private-key".to_string()]);
        let text = payload.to_string();
        assert!(!text.contains("private-token-123456"));
        assert!(!text.contains("custom-private-key"));
        assert!(!text.contains("sk-abcdefghijklmnop1234567890"));
        assert!(!text.contains("short-access-key"));
        assert!(!text.contains("short-client-secret"));
    }

    #[test]
    fn exported_payload_removes_standalone_hex_and_base64_secrets() {
        let mut payload = serde_json::json!({
            "messages": [
                {"content": "0123456789abcdef0123456789abcdef"},
                {"content": "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dg=="}
            ]
        });
        redact_json(&mut payload, &[]);
        let text = payload.to_string();
        assert!(!text.contains("0123456789abcdef0123456789abcdef"));
        assert!(!text.contains("YWJjZGVmZ2hpamtsbW5vcHFyc3R1dg=="));
    }

    #[test]
    fn provider_prefix_requires_a_boundary_and_a_full_token() {
        let text = redact_text("risk-free task-list ask- sk-short sk-abcdefghijklmnop", &[]);
        assert!(text.contains("risk-free task-list ask- sk-short"));
        assert!(!text.contains("sk-abcdefghijklmnop"));
    }
    #[test]
    fn exported_payload_keeps_public_chain_identifiers() {
        let address = format!("0x{}", "0123456789abcdef".repeat(4));
        let link = format!("https://etherscan.io/tx/{address}");
        let mut payload = serde_json::json!({"messages": [{"content": format!("{link} {address} secret-token")}]});
        redact_json(&mut payload, &["secret-token".to_string()]);
        let text = payload.to_string();
        assert!(text.contains(&link));
        assert!(text.contains(&address));
        assert!(!text.contains("secret-token"));
    }

    #[test]
    fn exported_payload_keeps_links_paths_addresses_and_prose() {
        let address = "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV";
        for text in [
            "https://github.com/domechn/track3/releases/download",
            "/Users/alice/Library/Application/Support/track3",
            "secret: I prefer low risk",
            "Your token: USDC is up",
        ] {
            assert_eq!(redact_text(text, &[]), text);
        }
        assert_eq!(redact_text(address, &[]), address);
    }

    #[tokio::test]
    async fn includes_broker_tokens_in_configured_secrets() {
        let mut conn = SqliteConnection::connect("sqlite::memory:").await.unwrap();
        sqlx::query("CREATE TABLE configuration (id INTEGER, data TEXT)")
            .execute(&mut conn)
            .await
            .unwrap();
        sqlx::query("INSERT INTO configuration (id, data) VALUES (20, 'brokers:\n  - token: broker-private-token')")
            .execute(&mut conn)
            .await
            .unwrap();
        let ent = Ent::new();
        let secrets = configured_secrets(&mut conn, &ent).await;
        assert!(secrets.contains(&"broker-private-token".to_string()));
    }
}
