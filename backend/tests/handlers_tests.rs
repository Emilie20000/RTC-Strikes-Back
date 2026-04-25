use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt;
use serde_json::{json, Value};

mod common;

#[tokio::test]
async fn test_root_handler() {
    let app = common::setup_test_app().await;

    let response = app
        .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_hello_world_handler() {
    let app = common::setup_test_app().await;

    let response = app
        .oneshot(Request::builder().uri("/api/hello").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    
    let body = axum::body::to_bytes(response.into_body(), 1000).await.unwrap();
    let body: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(body["message"], "Hello from Rust!");
}

#[tokio::test]
async fn test_db_check_handler() {
    let app = common::setup_test_app().await;

    let response = app
        .oneshot(Request::builder().uri("/api/db-check").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_auth_signup_handler_validation() {
    let app = common::setup_test_app().await;

    // Test missing fields
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/signup")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn test_404_handler() {
    let app = common::setup_test_app().await;

    let response = app
        .oneshot(Request::builder().uri("/non-existent").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_auth_signup_success() {
    let app = common::setup_test_app().await;
    let username = format!("user_{}", uuid::Uuid::new_v4());
    let email = format!("{}@example.com", username);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/signup")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({
                    "username": username,
                    "email": email,
                    "password": "password123"
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
}

#[tokio::test]
async fn test_server_handlers_unauthorized() {
    let app = common::setup_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/servers")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Should be unauthorized because no token is provided
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_auth_signup_duplicates() {
    let app = common::setup_test_app().await;
    let username = format!("user_{}", uuid::Uuid::new_v4());
    let email = format!("{}@example.com", username);

    // Initial signup
    let response = app.clone().oneshot(
        Request::builder()
            .method("POST")
            .uri("/api/auth/signup")
            .header("Content-Type", "application/json")
            .body(Body::from(json!({
                "username": username,
                "email": email,
                "password": "password123"
            }).to_string()))
            .unwrap()
    ).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    // Duplicate email
    let response = app.clone().oneshot(
        Request::builder()
            .method("POST")
            .uri("/api/auth/signup")
            .header("Content-Type", "application/json")
            .body(Body::from(json!({
                "username": format!("diff_{}", username),
                "email": email,
                "password": "password123"
            }).to_string()))
            .unwrap()
    ).await.unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);

    // Duplicate username
    let response = app.clone().oneshot(
        Request::builder()
            .method("POST")
            .uri("/api/auth/signup")
            .header("Content-Type", "application/json")
            .body(Body::from(json!({
                "username": username,
                "email": format!("diff_{}@example.com", username),
                "password": "password123"
            }).to_string()))
            .unwrap()
    ).await.unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn test_auth_login_failures() {
    let app = common::setup_test_app().await;
    let username = format!("user_{}", uuid::Uuid::new_v4());
    let email = format!("{}@example.com", username);

    // Create user
    app.clone().oneshot(
        Request::builder()
            .method("POST")
            .uri("/api/auth/signup")
            .header("Content-Type", "application/json")
            .body(Body::from(json!({
                "username": username,
                "email": email,
                "password": "password123"
            }).to_string()))
            .unwrap()
    ).await.unwrap();

    // Invalid email
    let response = app.clone().oneshot(
        Request::builder()
            .method("POST")
            .uri("/api/auth/login")
            .header("Content-Type", "application/json")
            .body(Body::from(json!({
                "email": "invalid@example.com",
                "password": "password123"
            }).to_string()))
            .unwrap()
    ).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    // Invalid password
    let response = app.clone().oneshot(
        Request::builder()
            .method("POST")
            .uri("/api/auth/login")
            .header("Content-Type", "application/json")
            .body(Body::from(json!({
                "email": email,
                "password": "wrongpassword"
            }).to_string()))
            .unwrap()
    ).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_auth_me_and_logout() {
    let app = common::setup_test_app().await;
    let username = format!("user_{}", uuid::Uuid::new_v4());
    let email = format!("{}@example.com", username);

    // Create user and get token
    let response = app.clone().oneshot(
        Request::builder()
            .method("POST")
            .uri("/api/auth/signup")
            .header("Content-Type", "application/json")
            .body(Body::from(json!({
                "username": username,
                "email": email,
                "password": "password123"
            }).to_string()))
            .unwrap()
    ).await.unwrap();
    let body = axum::body::to_bytes(response.into_body(), 10000).await.unwrap();
    let body: Value = serde_json::from_slice(&body).unwrap();
    let token = body["token"].as_str().unwrap();
    let auth_header = format!("Bearer {}", token);

    // Get me
    let response = app.clone().oneshot(
        Request::builder()
            .method("GET")
            .uri("/api/auth/me")
            .header("Authorization", &auth_header)
            .body(Body::empty())
            .unwrap()
    ).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // Logout
    let response = app.clone().oneshot(
        Request::builder()
            .method("POST")
            .uri("/api/auth/logout")
            .header("Authorization", &auth_header)
            .body(Body::empty())
            .unwrap()
    ).await.unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
}
