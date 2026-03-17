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

    // Delete channel subscribers
    sqlx::query(
        "DELETE FROM channel_subscribers WHERE channel_id = $1"
    )
    .bind(&channel_id)
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

pub async fn create_dm_channel(
    pool: &PgPool,
    user1_id: Uuid,
    user2_id: Uuid,
) -> Result<Channel, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Check if DM channel already exists
    let existing_dm = sqlx::query_as::<_, Channel>(
        r#"
        SELECT c.* 
        FROM channels c
        JOIN channel_subscribers cs1 ON c.id = cs1.channel_id
        JOIN channel_subscribers cs2 ON c.id = cs2.channel_id
        WHERE c.kind = 'DM' 
          AND cs1.user_id = $1 
          AND cs2.user_id = $2
        "#
    )
    .bind(&user1_id)
    .bind(&user2_id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(channel) = existing_dm {
        return Ok(channel);
    }

    // Create new DM channel
    let channel = sqlx::query_as::<_, Channel>(
        r#"
        INSERT INTO channels (kind, server_id)
        VALUES ('DM', NULL)
        RETURNING id, name, description, kind, server_id, created_at, updated_at
        "#
    )
    .fetch_one(&mut *tx)
    .await?;

    // Add subscribers
    sqlx::query("INSERT INTO channel_subscribers (channel_id, user_id) VALUES ($1, $2)")
        .bind(&channel.id)
        .bind(&user1_id)
        .execute(&mut *tx)
        .await?;

    if user1_id != user2_id {
        sqlx::query("INSERT INTO channel_subscribers (channel_id, user_id) VALUES ($1, $2)")
            .bind(&channel.id)
            .bind(&user2_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    Ok(channel)
}

pub async fn get_user_dm_channels(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<Channel>, sqlx::Error> {
    sqlx::query_as::<_, Channel>(
        r#"
        SELECT c.*
        FROM channels c
        JOIN channel_subscribers cs ON c.id = cs.channel_id
        WHERE cs.user_id = $1 AND c.kind = 'DM'
        ORDER BY c.updated_at DESC
        "#
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await
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
