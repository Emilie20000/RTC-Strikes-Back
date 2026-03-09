use sqlx::PgPool;
use uuid::Uuid;
use crate::models::channel::{Channel, CreateChannel, ChannelType};
use crate::services::permission::UserRole;

/// Check if a user can create a channel (Owner or Admin)
pub fn can_create_channel_check(role: UserRole) -> bool {
    matches!(role, UserRole::Owner | UserRole::Admin)
}

/// Check if a user can delete a channel
/// - User must be Owner
/// - Channel must not be a system channel (arrivées/départs)
pub fn can_delete_channel_check(role: UserRole, channel_name: &str) -> bool {
    if role != UserRole::Owner {
        return false;
    }
    
    !channel_name.contains("arrivées") && !channel_name.contains("départs")
}

pub async fn create_channel(
    pool: &PgPool,
    payload: CreateChannel,
) -> Result<Channel, sqlx::Error> {
    sqlx::query_as::<_, Channel>(
        r#"
        INSERT INTO channels (name, description, kind, server_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, description, kind, server_id, created_at, updated_at
        "#
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(payload.kind.unwrap_or(ChannelType::Text))
    .bind(&payload.server_id)
    .fetch_one(pool)
    .await
}

pub async fn get_channels_by_server_id(
    pool: &PgPool,
    server_id: Uuid,
) -> Result<Vec<Channel>, sqlx::Error> {
    sqlx::query_as::<_, Channel>(
        r#"
        SELECT id, name, description, kind, server_id, created_at, updated_at
        FROM channels
        WHERE server_id = $1
        ORDER BY created_at ASC
        "#
    )
    .bind(&server_id)
    .fetch_all(pool)
    .await
}

pub async fn get_channel_by_id(
    pool: &PgPool,
    channel_id: Uuid,
) -> Result<Option<Channel>, sqlx::Error> {
    sqlx::query_as::<_, Channel>(
        r#"
        SELECT id, name, description, kind, server_id, created_at, updated_at
        FROM channels
        WHERE id = $1
        "#
    )
    .bind(&channel_id)
    .fetch_optional(pool)
    .await
}

pub async fn delete_channel(
    pool: &PgPool,
    channel_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Check if channel exists
    let exists = sqlx::query("SELECT 1 FROM channels WHERE id = $1")
        .bind(&channel_id)
        .fetch_optional(&mut *tx)
        .await?;

    if exists.is_none() {
        return Err(sqlx::Error::RowNotFound);
    }

    // Delete messages first (manual cascade)
    sqlx::query(
        "DELETE FROM messages WHERE channel_id = $1"
    )
    .bind(channel_id.to_string())
    .execute(&mut *tx)
    .await?;

    // Delete channel
    sqlx::query(
        "DELETE FROM channels WHERE id = $1"
    )
    .bind(&channel_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_create_channel_check() {
        assert!(can_create_channel_check(UserRole::Owner));
        assert!(can_create_channel_check(UserRole::Admin));
        assert!(!can_create_channel_check(UserRole::Member));
    }

    #[test]
    fn test_can_delete_channel_check() {
        // Owner can delete normal channels
        assert!(can_delete_channel_check(UserRole::Owner, "general"));
        
        // Non-owner cannot delete anything
        assert!(!can_delete_channel_check(UserRole::Admin, "general"));
        assert!(!can_delete_channel_check(UserRole::Member, "general"));
        
        // System channels cannot be deleted even by Owner
        assert!(!can_delete_channel_check(UserRole::Owner, "📥-arrivées"));
        assert!(!can_delete_channel_check(UserRole::Owner, "📤-départs"));
    }
}
