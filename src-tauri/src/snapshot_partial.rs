use serde::{Deserialize, Serialize};
use sqlx::SqliteConnection;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PartialSnapshot {
    pub sources_total: i64,
    pub missing: Vec<MissingSource>,
    pub fill: Fill,
    pub created_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MissingSource {
    pub wallet: String,
    pub kind: SourceKind,
    pub provider: String,
    pub category: SourceCategory,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_success_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Fill {
    LastKnown,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceKind {
    Exchange,
    Wallet,
    Broker,
    Others,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceCategory {
    Auth,
    Service,
    Network,
    RateLimit,
    Quota,
    Unsupported,
    Other,
}

impl PartialSnapshot {
    pub fn from_value(value: serde_json::Value) -> Result<Self, String> {
        let marker: Self =
            serde_json::from_value(value).map_err(|_| "Invalid partial snapshot".to_string())?;
        if !(1..=10_000).contains(&marker.sources_total)
            || marker.missing.is_empty()
            || marker.missing.len() > 64
            || crate::refresh_persistence::validate_created_at(&marker.created_at).is_err()
            || marker.missing.iter().any(|source| {
                source.wallet.len() != 32
                    || !source
                        .wallet
                        .bytes()
                        .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
                    || source.provider.is_empty()
                    || source.provider.len() > 80
                    || source.provider.chars().any(char::is_control)
                    || source.last_success_at.as_ref().is_some_and(|at| {
                        crate::refresh_persistence::validate_created_at(at).is_err()
                    })
            })
        {
            return Err("Invalid partial snapshot".to_string());
        }
        Ok(marker)
    }

    pub async fn insert(&self, db: &mut SqliteConnection, uuid: &str) -> Result<(), String> {
        let missing = serde_json::to_string(&self.missing)
            .map_err(|_| "Invalid partial snapshot".to_string())?;
        sqlx::query("INSERT OR IGNORE INTO snapshot_partial (uuid, sources_total, missing, fill, created_at) VALUES (?, ?, ?, 'last_known', ?)")
            .bind(uuid).bind(self.sources_total).bind(missing).bind(&self.created_at)
            .execute(db).await
            .map_err(|_| "Failed to save partial snapshot".to_string())?;
        Ok(())
    }
}
