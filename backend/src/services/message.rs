use sqlx::PgPool;
use uuid::Uuid;
use crate::models::message::ChatMessage;
use chrono::Utc;

#[derive(Clone)]
pub struct AddReactionSchema {
    pub message_id: i32,
    pub user_id: Uuid,
    pub emoji: String,
}

pub async fn create_message(
    pool: &PgPool,
    channel_id: &str,
    author: &str,
    author_id: Option<Uuid>,
    content: &str,
) -> Result<ChatMessage, sqlx::Error> {
    let created_at = Utc::now().timestamp_millis();
    sqlx::query_as::<_, ChatMessage>(
        "INSERT INTO messages (channel_id, author, author_id, content, created_at) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, channel_id, author, author_id, content, created_at"
    )
    .bind(channel_id)
    .bind(author)
    .bind(author_id)
    .bind(content)
    .bind(created_at)
    .fetch_one(pool)
    .await
}

pub async fn get_channel_messages(
    pool: &PgPool,
    channel_id: &str,
    limit: i64,
) -> Result<Vec<ChatMessage>, sqlx::Error> {
    sqlx::query_as::<_, ChatMessage>(
        "SELECT id, channel_id, author, author_id, content, created_at 
         FROM messages 
         WHERE channel_id = $1 
         ORDER BY created_at ASC 
         LIMIT $2"
    )
    .bind(channel_id)
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn delete_message(
    pool: &PgPool,
    message_id: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM messages WHERE id = $1")
        .bind(message_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_message(
    pool: &PgPool,
    message_id: i32,
    content: &str,
) -> Result<ChatMessage, sqlx::Error> {
    sqlx::query_as::<_, ChatMessage>(
        "UPDATE messages SET content = $1 WHERE id = $2 
         RETURNING id, channel_id, author, author_id, content, created_at"
    )
    .bind(content)
    .bind(message_id)
    .fetch_one(pool)
    .await
}

pub async fn add_reaction(
    pool: &PgPool,
    schema: AddReactionSchema,
) -> Result<String, sqlx::Error> {
    let AddReactionSchema {
        message_id,
        user_id,
        emoji,
    } = schema;

    sqlx::query(
        "INSERT INTO message_reactions (message_id, user_id, emoji)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING"
    )
    .bind(message_id)
    .bind(user_id)
    .bind(&emoji)
    .execute(pool)
    .await?;

    let channel_id = sqlx::query_scalar::<_, String>(
        "SELECT channel_id FROM messages WHERE id = $1"
    )
    .bind(message_id)
    .fetch_one(pool)
    .await?;

    Ok(channel_id)
}