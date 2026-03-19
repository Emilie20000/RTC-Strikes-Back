use axum::{
    Extension,
    Json,
    http::StatusCode,
};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct AddReactionSchema {
    pub message_id: i32,
    pub user_id: Uuid,
    pub emoji: String,
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