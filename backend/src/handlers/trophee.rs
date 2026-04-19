use axum::{extract::State, http::StatusCode, Extension, Json};
use serde_json::json;
use std::sync::Arc;

use crate::{middleware::auth::AuthUser, services::trophee, AppState};

pub async fn get_user_trophees(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<trophee::Trophee>>, (StatusCode, Json<serde_json::Value>)> {
    let result = trophee::sync_user_trophees(&state.pool, auth_user.user_id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Failed to get trophies: {}", e) })),
            )
        })?;

    trophee::notify_unlocked(&state.io, auth_user.user_id, &result.newly_unlocked).await;

    Ok(Json(result.trophees))
}
