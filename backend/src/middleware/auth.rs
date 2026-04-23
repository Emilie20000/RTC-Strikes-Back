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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        middleware::from_fn_with_state,
        routing::get,
        Router,
    };
    use tower::ServiceExt;
    use crate::services::auth::generate_token;

    // Helper to create a dummy AppState for tests
    // Note: This still requires a pool, but for unit tests of non-db parts it can be uninitialized or mock
    async fn setup_test_router(state: Arc<AppState>) -> Router {
        Router::new()
            .route("/", get(|| async { "OK" }))
            .layer(from_fn_with_state(state.clone(), auth_middleware))
            .with_state(state)
    }

    #[tokio::test]
    async fn test_auth_middleware_missing_token() {
        let pool = sqlx::PgPool::connect_lazy("postgres://localhost/test").unwrap();
        let voice_users = Arc::new(dashmap::DashMap::new());
        let redis_client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
        let io = socketioxide::SocketIo::builder().build_layer().1;
        
        let state = Arc::new(AppState {
            pool,
            io,
            voice_users,
            redis_client,
        });

        let app = setup_test_router(state).await;

        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_auth_middleware_invalid_token() {
        let pool = sqlx::PgPool::connect_lazy("postgres://localhost/test").unwrap();
        let voice_users = Arc::new(dashmap::DashMap::new());
        let redis_client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
        let io = socketioxide::SocketIo::builder().build_layer().1;
        
        let state = Arc::new(AppState {
            pool,
            io,
            voice_users,
            redis_client,
        });

        let app = setup_test_router(state).await;

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/")
                    .header("Authorization", "Bearer invalid-token")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }
}
