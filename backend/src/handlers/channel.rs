use axum::{
    extract::{State, Path},
    http::StatusCode,
    Extension,
    Json,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    models::channel::{Channel, CreateChannel},
    services::{
        channel as channel_service,
        permission::{self, UserRole},
    },
    middleware::auth::AuthUser,
    AppState,
};

// Create a channel
pub async fn create_channel(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateChannel>,
) -> Result<(StatusCode, Json<Channel>), (StatusCode, Json<serde_json::Value>)> {
    // Verify user has permission to create channel in this server (Owner or Admin)
    let role = permission::get_user_role(&state.pool, auth_user.user_id, payload.server_id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Database error: {}", e)})),
            )
        })?
        .ok_or((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "You are not a member of this server"})),
        ))?;

    if !channel_service::can_create_channel_check(role) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "Only admins and owners can create channels"})),
        ));
    }
    
    let channel = channel_service::create_channel(&state.pool, payload.clone())
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to create channel: {}", e)})),
            )
        })?;
    
    crate::socket::broadcast_channel_created(&state.io, payload.server_id, channel.clone()).await;
    
    Ok((StatusCode::CREATED, Json(channel)))
}

// Get channels for a server
pub async fn get_server_channels(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<Json<Vec<Channel>>, (StatusCode, Json<serde_json::Value>)> {
    // Verify user is member of server
    let is_member = permission::is_server_member(&state.pool, auth_user.user_id, server_id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Database error: {}", e)})),
            )
        })?;

    if !is_member {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "You are not a member of this server"})),
        ));
    }
    
    let channels = channel_service::get_channels_by_server_id(&state.pool, server_id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Database error: {}", e)})),
            )
        })?;
    
    Ok(Json(channels))
}

// Delete a channel
pub async fn delete_channel(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    // Get channel to find server_id
    let channel = channel_service::get_channel_by_id(&state.pool, channel_id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Database error: {}", e)})),
            )
        })?
        .ok_or((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Channel not found"})),
        ))?;

    if let Some(server_id) = channel.server_id {
        // Verify user is Owner of the server
        let role = permission::get_user_role(&state.pool, auth_user.user_id, server_id)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("Database error: {}", e)})),
                )
            })?
            .ok_or((
                StatusCode::FORBIDDEN,
                Json(json!({"error": "You are not a member of this server"})),
            ))?;

        let channel_name = channel.name.as_deref().unwrap_or("");
        if !channel_service::can_delete_channel_check(role, channel_name) {
             if role != UserRole::Owner {
                return Err((
                    StatusCode::FORBIDDEN,
                    Json(json!({"error": "Only the server owner can delete channels"})),
                ));
            } else {
                return Err((
                    StatusCode::FORBIDDEN,
                    Json(json!({"error": "Les salons système ne peuvent pas être supprimés"})),
                ));
            }
        }
    } else {
        // Handle case where channel has no server_id (e.g. DM?)
        // For now, assume only server channels exist and require server_id
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Cannot delete channel without server"})),
        ));
    }

    channel_service::delete_channel(&state.pool, channel_id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to delete channel: {}", e)})),
            )
        })?;
    
    if let Some(server_id) = channel.server_id {
        crate::socket::broadcast_channel_deleted(&state.io, server_id, channel_id).await;
    }
    
    Ok(StatusCode::NO_CONTENT)
}
