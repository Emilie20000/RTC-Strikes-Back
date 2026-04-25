use axum::{
    extract::State,
    http::StatusCode,
    Extension,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::{
    models::user::{UserStatus, UpdateUserPayload},
    middleware::auth::AuthUser,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct UpdateStatusPayload {
    pub status: UserStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserStatusChangedPayload {
    pub user_id: String,
    pub status: UserStatus,
}

// pour gerer les status
pub async fn update_user_status(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<UpdateStatusPayload>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    sqlx::query(
        "UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2"
    )
    .bind(&payload.status)
    .bind(&auth_user.user_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Failed to update status: {}", e)})),
        )
    })?;

    let server_ids: Vec<(uuid::Uuid,)> = sqlx::query_as(
        "SELECT server_id FROM server_members WHERE user_id = $1"
    )
    .bind(&auth_user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        eprintln!("Failed to fetch user servers: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch user servers"})),
        )
    })?;

    // Broadcast to each server
    for (server_id,) in server_ids {
        crate::socket::broadcast_user_status_changed(
            &state.io,
            server_id,
            auth_user.user_id,
            payload.status.clone(),
        ).await;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_user_profile(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<UpdateUserPayload>,
) -> Result<Json<crate::models::user::PublicUser>, (StatusCode, Json<serde_json::Value>)> {
    if let Some(langue) = &payload.langue {
        if langue != "fr" && langue != "en" {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid langue. Allowed values: fr, en"})),
            ));
        }
    }

    let mut tx = state.pool.begin().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Database error: {}", e)})),
        )
    })?;

    if let Some(username) = &payload.username {
        let exists = sqlx::query("SELECT 1 FROM users WHERE username = $1 AND id != $2")
            .bind(username)
            .bind(auth_user.user_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("Database error: {}", e)})),
                )
            })?;

        if exists.is_some() {
            return Err((
                StatusCode::CONFLICT,
                Json(json!({"error": "Username already taken"})),
            ));
        }
    }

    let mut query = "UPDATE users SET updated_at = NOW()".to_string();
    let mut i = 1;

    if payload.username.is_some() {
        query.push_str(&format!(", username = ${}", i));
        i += 1;
    }
    if payload.avatar_url.is_some() {
        query.push_str(&format!(", avatar_url = ${}", i));
        i += 1;
    }
    if payload.langue.is_some() {
        query.push_str(&format!(", langue = ${}", i));
        i += 1;
    }

    query.push_str(&format!(" WHERE id = ${} RETURNING *", i));

    let mut q = sqlx::query_as::<_, crate::models::user::User>(&query);

    if let Some(username) = &payload.username {
        q = q.bind(username);
    }
    if let Some(avatar_url) = &payload.avatar_url {
        q = q.bind(avatar_url);
    }
    if let Some(langue) = &payload.langue {
        q = q.bind(langue);
    }
    q = q.bind(auth_user.user_id);

    let updated_user = q.fetch_one(&mut *tx).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Failed to update user: {}", e)})),
        )
    })?;

    tx.commit().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Failed to commit transaction: {}", e)})),
        )
    })?;

    let server_ids: Vec<(uuid::Uuid,)> = sqlx::query_as(
        "SELECT server_id FROM server_members WHERE user_id = $1"
    )
        .bind(&auth_user.user_id)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    //broadcast d'update
    for (server_id,) in server_ids {
        crate::socket::broadcast_user_updated(&state.io, server_id, updated_user.clone().into()).await;

        if let Some(mut voice_state) = state.voice_users.get_mut(&auth_user.user_id.to_string()) {
            if let Some(username) = &payload.username {
                voice_state.username = username.clone();
            }
            if let Some(avatar_url) = &payload.avatar_url {
                voice_state.avatar_url = Some(avatar_url.clone());
            }

            let _ = state.io
                .to(server_id.to_string())
                .emit("voice_state_update", &*voice_state)
                .await;
        }
    }

    // Broadcast update to DM contacts
    let dm_recipient_ids: Vec<(uuid::Uuid,)> = sqlx::query_as(
        r#"
        SELECT DISTINCT cs2.user_id
        FROM channel_subscribers cs1
        JOIN channels c ON cs1.channel_id = c.id
        JOIN channel_subscribers cs2 ON c.id = cs2.channel_id
        WHERE c.kind = 'DM' AND cs1.user_id = $1 AND cs2.user_id != $1
        "#
    )
    .bind(&auth_user.user_id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    for (recipient_id,) in dm_recipient_ids {
        let room = format!("user:{}", recipient_id);
        let payload = json!({
            "user": crate::models::user::PublicUser::from(updated_user.clone()),
            "serverId": null
        });
        let _ = state.io.to(room).emit("user_updated", &payload).await;
    }

    Ok(Json(updated_user.into()))
}
