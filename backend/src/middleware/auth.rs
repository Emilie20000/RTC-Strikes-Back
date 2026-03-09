use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
    Json,
};
use serde_json::json;
use uuid::Uuid;
use std::sync::Arc;

use crate::services::auth::verify_token;
use crate::AppState;

/// Extension type to store the authenticated user ID
#[derive(Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
}

/// Middleware to verify JWT token and extract user ID
pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    // Extract token from Authorization header
    let token = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({
                    "error": "Missing or invalid Authorization header"
                })),
            )
        })?;

    // Verify token
    let claims = verify_token(token).map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "Invalid or expired token"
            })),
        )
    })?;

    // Parse user ID from claims
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "Invalid user ID in token"
            })),
        )
    })?;

    // Verify user exists in database
    let user_exists = sqlx::query("SELECT 1 FROM users WHERE id = $1")
        .bind(&user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "error": "Database error"
                })),
            )
        })?
        .is_some();

    if !user_exists {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "User not found"
            })),
        ));
    }

    // Insert user ID into request extensions
    request.extensions_mut().insert(AuthUser { user_id });

    Ok(next.run(request).await)
}
