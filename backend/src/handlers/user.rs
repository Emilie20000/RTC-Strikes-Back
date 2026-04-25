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
                Json(json!({ "error": "Invalid langue. Allowed values: fr, en" })),
            ));
        }
    }

    let mut tx = state.pool.begin().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })),
        )
    })?;

    if let Some(username) = &payload.username {
        let exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM users WHERE username = $1 AND id != $2"
        )
            .bind(username)
            .bind(auth_user.user_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error: {}", e) })),
            ))?;

        if exists > 0 {
            return Err((
                StatusCode::CONFLICT,
                Json(json!({ "error": "Username already taken" })),
            ));
        }
    }

    // 🔥 SAFE UPDATE (no dynamic SQL hell)
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
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Failed to update user: {}", e) })),
            )
        })?;

    tx.commit().await.map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": format!("Commit failed: {}", e) })),
    ))?;

    Ok(Json(updated_user.into()))
}