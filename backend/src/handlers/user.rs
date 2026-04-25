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
pub async fn update_user_profile(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<UpdateUserPayload>,
) -> Result<Json<crate::models::user::PublicUser>, (StatusCode, Json<serde_json::Value>)> {

    // ----------------------------
    // 1. Validation langue
    // ----------------------------
    if let Some(langue) = &payload.langue {
        if langue != "fr" && langue != "en" {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Invalid langue. Allowed values: fr, en" })),
            ));
        }
    }

    // ----------------------------
    // 2. Transaction
    // ----------------------------
    let mut tx = state.pool.begin().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })),
        )
    })?;

    // ----------------------------
    // 3. Username uniqueness check
    // ----------------------------
    if let Some(username) = &payload.username {
        let exists: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM users WHERE username = $1 AND id != $2"
        )
            .bind(username)
            .bind(auth_user.user_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error: {}", e) })),
            ))?;

        if exists.is_some() {
            return Err((
                StatusCode::CONFLICT,
                Json(json!({ "error": "Username already taken" })),
            ));
        }
    }

    // ----------------------------
    // 4. SAFE UPDATE (no dynamic SQL)
    // ----------------------------
    let updated_user = sqlx::query_as::<_, crate::models::user::User>(
        r#"
        UPDATE users
        SET
            username   = COALESCE($1, username),
            avatar_url = COALESCE($2, avatar_url),
            langue     = COALESCE($3, langue),
            updated_at = NOW()
        WHERE id = $4
        RETURNING
            id,
            username,
            email,
            password_hash,
            avatar_url,
            langue,
            status,
            created_at,
            updated_at
        "#
    )
        .bind(&payload.username)
        .bind(&payload.avatar_url)
        .bind(&payload.langue)
        .bind(auth_user.user_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            eprintln!("🔥 update_user_profile SQL error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Failed to update user: {}", e) })),
            )
        })?;

    // ----------------------------
    // 5. Commit
    // ----------------------------
    tx.commit().await.map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": format!("Commit failed: {}", e) })),
    ))?;

    // ----------------------------
    // 6. Response
    // ----------------------------
    Ok(Json(updated_user.into()))
}