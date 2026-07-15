use std::path::Path;

use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection};

use super::{
    journal::{ConfigurationRotation, RotationJournal},
    ExecutionError,
};

pub(super) async fn load_encrypted_rows(
    database_path: &Path,
) -> Result<Vec<(i64, String)>, String> {
    let mut connection = connect(database_path).await?;
    let rows = sqlx::query_as::<_, (i64, String)>(
        "SELECT id, data FROM configuration WHERE data LIKE '!ent:%' ORDER BY id",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("configuration preflight query failed: {error}"))?;
    connection
        .close()
        .await
        .map_err(|error| format!("configuration preflight close failed: {error}"))?;
    Ok(rows)
}

pub(super) async fn replace_configuration_rows(
    database_path: &Path,
    journal: &RotationJournal,
    use_new: bool,
) -> Result<(), ExecutionError> {
    let mut connection = connect(database_path)
        .await
        .map_err(ExecutionError::operational)?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| ExecutionError::operational(format!("database begin failed: {error}")))?;

    for configuration in &journal.configurations {
        normalize_configuration_row(&mut transaction, configuration, use_new).await?;
    }
    transaction
        .commit()
        .await
        .map_err(|error| ExecutionError::operational(format!("database commit failed: {error}")))?;
    connection
        .close()
        .await
        .map_err(|error| ExecutionError::operational(format!("database close failed: {error}")))?;
    Ok(())
}

pub(super) async fn current_configuration_value(
    connection: &mut SqliteConnection,
    id: i64,
) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, String>("SELECT data FROM configuration WHERE id = ?")
        .bind(id)
        .fetch_optional(connection)
        .await
        .map_err(|error| format!("configuration verification read failed for row {id}: {error}"))
}

pub(super) async fn open(database_path: &Path) -> Result<SqliteConnection, String> {
    connect(database_path).await
}

async fn normalize_configuration_row(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    configuration: &ConfigurationRotation,
    use_new: bool,
) -> Result<(), ExecutionError> {
    let (expected, replacement) = if use_new {
        (&configuration.old_ciphertext, &configuration.new_ciphertext)
    } else {
        (&configuration.new_ciphertext, &configuration.old_ciphertext)
    };
    let current = sqlx::query_scalar::<_, String>("SELECT data FROM configuration WHERE id = ?")
        .bind(configuration.id)
        .fetch_optional(&mut **transaction)
        .await
        .map_err(|error| {
            ExecutionError::operational(format!(
                "database read failed for configuration row {}: {error}",
                configuration.id
            ))
        })?
        .ok_or_else(|| {
            ExecutionError::operational(format!(
                "configuration row {} disappeared during rotation",
                configuration.id
            ))
        })?;
    if current == *replacement {
        return Ok(());
    }
    if current != *expected {
        return Err(ExecutionError::operational(format!(
            "configuration row {} changed during rotation",
            configuration.id
        )));
    }

    let result = sqlx::query("UPDATE configuration SET data = ? WHERE id = ? AND data = ?")
        .bind(replacement)
        .bind(configuration.id)
        .bind(expected)
        .execute(&mut **transaction)
        .await
        .map_err(|error| {
            ExecutionError::operational(format!(
                "database update failed for configuration row {}: {error}",
                configuration.id
            ))
        })?;
    if result.rows_affected() != 1 {
        return Err(ExecutionError::operational(format!(
            "configuration row {} changed during rotation",
            configuration.id
        )));
    }
    Ok(())
}

async fn connect(database_path: &Path) -> Result<SqliteConnection, String> {
    SqliteConnection::connect_with(
        &SqliteConnectOptions::new()
            .filename(database_path)
            .create_if_missing(false),
    )
    .await
    .map_err(|error| {
        format!(
            "failed to open rotation database {}: {error}",
            database_path.display()
        )
    })
}
