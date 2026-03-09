use axum::{extract::State, http::StatusCode, Extension, Json};
use serde_json::json;
use std::sync::Arc;

use crate::{
    models::user::{CreateUser, LoginUser, PublicUser, User},
    services::auth::{generate_token, hash_password, verify_password},
    middleware::auth::AuthUser,
    AppState,
};

/// Handler for user signup
pub async fn signup(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUser>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    // Check if user already exists
    let existing_user = sqlx::query("SELECT id FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Database error: {}", e)})),
            )
        })?;

    if existing_user.is_some() {
        return Err((
            StatusCode::CONFLICT,
            Json(json!({"error": "User with this email already exists"})),
        ));
    }

    // Hash password
    let password_hash = hash_password(&payload.password).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to hash password"})),
        )
    })?;

    // Create user
    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (username, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, username, email, password_hash, avatar_url, 
                  status, created_at, updated_at
        "#
    )
    .bind(&payload.username)
    .bind(&payload.email)
    .bind(&password_hash)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Failed to create user: {}", e)})),
        )
    })?;

    // Generate token
    let token = generate_token(user.id).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to generate token"})),
        )
    })?;

    let public_user: PublicUser = user.into();

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "user": public_user,
            "token": token
        })),
    ))
}

/// Handler for user login
pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginUser>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Find user by email
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, username, email, password_hash, avatar_url,
               status, created_at, updated_at
        FROM users
        WHERE email = $1
        "#
    )
    .bind(&payload.email)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Database error"})),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid email or password"})),
        )
    })?;

    // Verify password
    let password_valid = verify_password(&payload.password, &user.password_hash).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to verify password"})),
        )
    })?;

    if !password_valid {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid email or password"})),
        ));
    }

    // Generate token
    let token = generate_token(user.id).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to generate token"})),
        )
    })?;

    let public_user: PublicUser = user.into();

    Ok(Json(json!({
        "user": public_user,
        "token": token
    })))
}

/// Handler to get current user information
pub async fn get_me(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<PublicUser>, (StatusCode, Json<serde_json::Value>)> {
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, username, email, password_hash, avatar_url,
               status, created_at, updated_at
        FROM users
        WHERE id = $1
        "#
    )
    .bind(&auth_user.user_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "User not found"})),
        )
    })?;

    Ok(Json(user.into()))
}

pub async fn logout() -> StatusCode {
    StatusCode::OK
}
