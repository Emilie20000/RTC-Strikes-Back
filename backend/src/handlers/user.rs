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

    // 1. Validation langue
    if let Some(langue) = &payload.langue {
        if langue != "fr" && langue != "en" {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "Invalid langue. Allowed values: fr, en"
                })),
            ));
        }
    }

    // 2. Check username uniqueness (si modifié)
    if let Some(username) = &payload.username {
        let exists: Option<(i32,)> = sqlx::query_as(
            "SELECT 1 FROM users WHERE username = $1 AND id != $2"
        )
            .bind(username)
            .bind(auth_user.user_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            ))?;

        if exists.is_some() {
            return Err((
                StatusCode::CONFLICT,
                Json(json!({ "error": "Username already taken" })),
            ));
        }
    }

    // 3. UPDATE SAFE (NO SQL DYNAMIQUE)
    let updated_user = sqlx::query_as::<_, crate::models::user::User>(
        r#"
        UPDATE users
        SET
            username = COALESCE($1, username),
            avatar_url = COALESCE($2, avatar_url),
            langue = COALESCE($3, langue),
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
        "#
    )
        .bind(&payload.username)
        .bind(&payload.avatar_url)
        .bind(&payload.langue)
        .bind(auth_user.user_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to update user: {}", e) })),
        ))?;

    // 4. Server broadcasts
    let server_ids: Vec<(uuid::Uuid,)> = sqlx::query_as(
        "SELECT server_id FROM server_members WHERE user_id = $1"
    )
        .bind(&auth_user.user_id)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    for (server_id,) in server_ids {
        let _ = crate::socket::broadcast_user_updated(
            &state.io,
            server_id,
            updated_user.clone().into(),
        ).await;

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

    // 5. DM broadcasts
    let dm_recipient_ids: Vec<(uuid::Uuid,)> = sqlx::query_as(
        r#"
        SELECT DISTINCT cs2.user_id
        FROM channel_subscribers cs1
        JOIN channels c ON cs1.channel_id = c.id
        JOIN channel_subscribers cs2 ON c.id = cs2.channel_id
        WHERE c.kind = 'DM'
        AND cs1.user_id = $1
        AND cs2.user_id != $1
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