use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension,
    Json,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use sqlx::PgPool;
use socketioxide::SocketIo;
use crate::services::message::add_reaction;
use crate::{
    models::{message::ChatMessage, user::User},
    services::{
        channel as channel_service,
        permission::{self, UserRole},
    },
    middleware::auth::AuthUser,
    AppState,
};

use serde::Deserialize;
use crate::services::message::AddReactionSchema;
use crate::services::message;

#[derive(Deserialize)]
pub struct UpdateMessageSchema {
    pub content: String,
}

#[derive(Deserialize)]
pub struct AddReactionRequest {
    pub message_id: i32,
    pub emoji: String,
}

use redis::AsyncCommands;

// Update a message
pub async fn update_message(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(message_id): Path<i32>,
    Json(payload): Json<UpdateMessageSchema>,
) -> Result<Json<ChatMessage>, (StatusCode, Json<serde_json::Value>)> {
    // 1. Get message
    let message = sqlx::query_as::<_, ChatMessage>(
        "SELECT id, channel_id, author, content, created_at FROM messages WHERE id = $1"
    )
    .bind(message_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Database error: {}", e)})),
        )
    })?
    .ok_or((
        StatusCode::NOT_FOUND,
        Json(json!({"error": "Message not found"})),
    ))?;

    // 2. Get requesting user
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1"
    )
    .bind(auth_user.user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Database error: {}", e)})),
        )
    })?
    .ok_or((
        StatusCode::UNAUTHORIZED,
        Json(json!({"error": "User not found"})),
    ))?;

    // 3. Check if user is author (Only author can edit)
    if message.author != user.username {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "You can only edit your own messages"})),
        ));
    }

    // 4. Update message
    let updated_message = sqlx::query_as::<_, ChatMessage>(
        "UPDATE messages SET content = $1 WHERE id = $2 RETURNING id, channel_id, author, content, created_at"
    )
    .bind(&payload.content)
    .bind(message_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Database error: {}", e)})),
        )
    })?;

    // Invalidate cache
    let mut conn = state.redis_client.get_multiplexed_tokio_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Redis connection error"})),
        )
    })?;
    let cache_key = format!("messages:{}", updated_message.channel_id);
    let _: () = conn.del(cache_key).await.unwrap_or_default();

    crate::socket::broadcast_message_updated(&state.io, updated_message.clone()).await;

    Ok(Json(updated_message))
}

pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    Extension(_auth_user): Extension<AuthUser>,
    Path(channel_id): Path<String>,
) -> Result<Json<Vec<ChatMessage>>, (StatusCode, Json<serde_json::Value>)> {
    let cache_key = format!("messages:{}", channel_id);
    
    // Try to get from Redis
    if let Ok(mut conn) = state.redis_client.get_multiplexed_tokio_connection().await {
        if let Ok(cached_messages) = conn.get::<_, String>(&cache_key).await {
            if let Ok(messages) = serde_json::from_str::<Vec<ChatMessage>>(&cached_messages) {
                return Ok(Json(messages));
            }
        }
    }

    // Fallback to database
    let messages = sqlx::query_as::<_, ChatMessage>(
        "SELECT id, channel_id, author, content, created_at FROM messages WHERE channel_id = $1 ORDER BY created_at ASC"
    )
    .bind(&channel_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Database error: {}", e)})),
        )
    })?;

    // Cache results for 1 hour
    if let Ok(mut conn) = state.redis_client.get_multiplexed_tokio_connection().await {
        if let Ok(serialized) = serde_json::to_string(&messages) {
            let _: () = conn.set_ex(cache_key, serialized, 3600).await.unwrap_or_default();
        }
    }

    Ok(Json(messages))
}

// Delete a message
pub async fn delete_message(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(message_id): Path<i32>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    // 1. Get message
    let message = sqlx::query_as::<_, ChatMessage>(
        "SELECT id, channel_id, author, content, created_at FROM messages WHERE id = $1"
    )
    .bind(message_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Database error: {}", e)})),
        )
    })?
    .ok_or((
        StatusCode::NOT_FOUND,
        Json(json!({"error": "Message not found"})),
    ))?;

    // 2. Get requesting user to check username
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1"
    )
    .bind(auth_user.user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Database error: {}", e)})),
        )
    })?
    .ok_or((
        StatusCode::UNAUTHORIZED,
        Json(json!({"error": "User not found"})),
    ))?;

    // 3. Determine permissions using pure logic helper
    let is_author = message.author == user.username;
    let mut role: Option<UserRole> = None;

    if !is_author {
        // Only fetch role if not author (optimization)
        if let Ok(channel_uuid) = Uuid::parse_str(&message.channel_id) {
            if let Ok(Some(channel)) = channel_service::get_channel_by_id(&state.pool, channel_uuid).await {
                if let Some(server_id) = channel.server_id {
                    if let Ok(role_opt) = permission::get_user_role(&state.pool, auth_user.user_id, server_id).await {
                        role = role_opt;
                    }
                }
            }
        }
    }

    if !permission::can_delete_message_check(is_author, role) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "You don't have permission to delete this message"})),
        ));
    }

    let channel_id = message.channel_id.clone();

    // 5. Delete message
    sqlx::query("DELETE FROM messages WHERE id = $1")
        .bind(message_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to delete message: {}", e)})),
            )
        })?;

    if let Ok(mut conn) = state.redis_client.get_multiplexed_tokio_connection().await {
        let cache_key = format!("messages:{}", channel_id);
        let _: () = conn.del(cache_key).await.unwrap_or_default();
    }

    crate::socket::broadcast_message_deleted(&state.io, message.channel_id.clone(), message_id as i64).await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn add_reaction_handler(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<AddReactionRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {

    let AddReactionRequest { message_id, emoji } = payload;

    let schema = AddReactionSchema {
        message_id,
        user_id: auth_user.user_id,
        emoji: emoji.clone(),
    };

    let channel_id = message::add_reaction(&state.pool, schema)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ws_payload = serde_json::json!({
        "messageId": message_id,
        "userId": auth_user.user_id,
        "emoji": emoji
    });

    let _ = state.io.to(channel_id).emit("reaction_added", &ws_payload).await;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}
