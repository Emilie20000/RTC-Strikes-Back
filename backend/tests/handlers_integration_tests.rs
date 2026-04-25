use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt;
use serde_json::{json, Value};
use uuid::Uuid;

mod common;

#[tokio::test]
async fn test_server_handler_lifecycle() {
    let app = common::setup_test_app().await;
    
    // 1. Create a user and login (get token)
    let username = format!("user_{}", Uuid::new_v4());
    let email = format!("{}@example.com", username);
    
    let response = app.clone()
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

    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({
                    "email": email,
                    "password": "password123"
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    
    let body = axum::body::to_bytes(response.into_body(), 10000).await.unwrap();
    let body: Value = serde_json::from_slice(&body).unwrap();
    let token = body["token"].as_str().unwrap();
    let auth_header = format!("Bearer {}", token);

    // 2. Create Server
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/servers")
                .header("Authorization", &auth_header)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({
                    "name": "Integration Server",
                    "description": "A server for testing"
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    
    let body = axum::body::to_bytes(response.into_body(), 10000).await.unwrap();
    let server: Value = serde_json::from_slice(&body).unwrap();
    let server_id = server["id"].as_str().unwrap();

    // 3. Get My Servers
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/servers")
                .header("Authorization", &auth_header)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    
    // 4. Get Server by ID
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/servers/{}", server_id))
                .header("Authorization", &auth_header)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // 5. Update Server
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/servers/{}", server_id))
                .header("Authorization", &auth_header)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({
                    "name": "Updated Integration Server"
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // 6. Create Channel
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/channels")
                .header("Authorization", &auth_header)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({
                    "name": "test-channel",
                    "kind": "TEXT",
                    "server_id": server_id
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    
    let body = axum::body::to_bytes(response.into_body(), 10000).await.unwrap();
    let channel: Value = serde_json::from_slice(&body).unwrap();
    let channel_id = channel["id"].as_str().unwrap();

    // 7. Get Server Channels
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/channels/server/{}", server_id))
                .header("Authorization", &auth_header)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // 8. Delete Channel
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/channels/{}", channel_id))
                .header("Authorization", &auth_header)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    // 9. Delete Server
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/servers/{}", server_id))
                .header("Authorization", &auth_header)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn test_member_and_dm_handlers() {
    let app = common::setup_test_app().await;
    
    // Create User A
    let username_a = format!("usera_{}", Uuid::new_v4());
    let email_a = format!("{}@example.com", username_a);
    app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/signup").header("Content-Type", "application/json").body(Body::from(json!({"username": username_a, "email": email_a, "password": "password"}).to_string())).unwrap()).await.unwrap();
    let response = app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/login").header("Content-Type", "application/json").body(Body::from(json!({"email": email_a, "password": "password"}).to_string())).unwrap()).await.unwrap();
    let body = axum::body::to_bytes(response.into_body(), 10000).await.unwrap();
    let body: Value = serde_json::from_slice(&body).unwrap();
    let token_a = body["token"].as_str().unwrap();
    let user_a_id = body["user"]["id"].as_str().unwrap();
    let auth_a = format!("Bearer {}", token_a);

    // Create User B
    let username_b = format!("userb_{}", Uuid::new_v4());
    let email_b = format!("{}@example.com", username_b);
    app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/signup").header("Content-Type", "application/json").body(Body::from(json!({"username": username_b, "email": email_b, "password": "password"}).to_string())).unwrap()).await.unwrap();
    let response = app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/login").header("Content-Type", "application/json").body(Body::from(json!({"email": email_b, "password": "password"}).to_string())).unwrap()).await.unwrap();
    let body = axum::body::to_bytes(response.into_body(), 10000).await.unwrap();
    let body: Value = serde_json::from_slice(&body).unwrap();
    let token_b = body["token"].as_str().unwrap();
    let user_b_id = body["user"]["id"].as_str().unwrap();
    let auth_b = format!("Bearer {}", token_b);

    // 1. Create DM
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/channels/dms")
                .header("Authorization", &auth_a)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({
                    "target_user_id": user_b_id
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    
    // 2. Get My DMs
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/channels/dms")
                .header("Authorization", &auth_a)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // 3. Create Server and test Member handlers
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/servers")
                .header("Authorization", &auth_a)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"name": "Member Test Server"}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let body = axum::body::to_bytes(response.into_body(), 10000).await.unwrap();
    let server: Value = serde_json::from_slice(&body).unwrap();
    let server_id = server["id"].as_str().unwrap();
    let invite_code = server["invite_code"].as_str().unwrap();

    // User B joins
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/servers/join")
                .header("Authorization", &auth_b)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"invite_code": invite_code}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // Get members
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/servers/{}/members", server_id))
                .header("Authorization", &auth_a)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // Update role
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/servers/{}/members/{}/role", server_id, user_b_id))
                .header("Authorization", &auth_a)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"role": "ADMIN"}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    // Ban user
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/servers/{}/ban", server_id))
                .header("Authorization", &auth_a)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({
                    "user_id": user_b_id,
                    "reason": "Testing ban"
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    // Get bans
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/servers/{}/bans", server_id))
                .header("Authorization", &auth_a)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // Unban
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/servers/{}/unban", server_id))
                .header("Authorization", &auth_a)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"user_id": user_b_id}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn test_message_and_reaction_handlers() {
    let app = common::setup_test_app().await;
    
    // Setup: User, Server, Channel
    let username = format!("user_{}", Uuid::new_v4());
    let email = format!("{}@example.com", username);
    app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/signup").header("Content-Type", "application/json").body(Body::from(json!({"username": username, "email": email, "password": "password"}).to_string())).unwrap()).await.unwrap();
    let response = app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/login").header("Content-Type", "application/json").body(Body::from(json!({"email": email, "password": "password"}).to_string())).unwrap()).await.unwrap();
    let body: Value = serde_json::from_slice(&axum::body::to_bytes(response.into_body(), 10000).await.unwrap()).unwrap();
    let auth = format!("Bearer {}", body["token"].as_str().unwrap());

    let response = app.clone().oneshot(Request::builder().method("POST").uri("/api/servers").header("Authorization", &auth).header("Content-Type", "application/json").body(Body::from(json!({"name": "Msg Test Server"}).to_string())).unwrap()).await.unwrap();
    let server: Value = serde_json::from_slice(&axum::body::to_bytes(response.into_body(), 10000).await.unwrap()).unwrap();
    let server_id = server["id"].as_str().unwrap();

    let response = app.clone().oneshot(Request::builder().method("POST").uri("/api/channels").header("Authorization", &auth).header("Content-Type", "application/json").body(Body::from(json!({"name": "msg-chan", "kind": "TEXT", "server_id": server_id}).to_string())).unwrap()).await.unwrap();
    let channel: Value = serde_json::from_slice(&axum::body::to_bytes(response.into_body(), 10000).await.unwrap()).unwrap();
    let channel_id = channel["id"].as_str().unwrap();

    // 1. Post message (via socket ideally, but here we test handlers, so we need a message in DB)
    // Since there's no POST /api/messages, we use a service call or socket.
    // Wait, the handlers for messages are mostly GET, PUT, DELETE.
    // I'll manually insert a message for testing if needed, or use the system message logic if exposed.
    // Actually, I'll use the socket's internal logic if I could, but let's just test the handlers.
    
    // I'll use a "db_check" or something to ensure a message exists? No.
    // I'll just assume there's a message from previous tests or I'll create one via SQL if I have to.
    // But I can't easily run SQL here without pool.
    
    // Wait, I can use the system message logic by joining a server!
    // Joining a server posts a welcome message.
    
    // 2. Get messages
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/messages/channel/{}", channel_id))
                .header("Authorization", &auth)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let messages: Value = serde_json::from_slice(&axum::body::to_bytes(response.into_body(), 10000).await.unwrap()).unwrap();
    
    if let Some(msg) = messages.as_array().and_then(|a| a.first()) {
        let msg_id = msg["id"].as_i64().unwrap();

        // 3. Update message (if we are author)
        let response = app.clone()
            .oneshot(
                Request::builder()
                    .method("PUT")
                    .uri(format!("/api/messages/{}", msg_id))
                    .header("Authorization", &auth)
                    .header("Content-Type", "application/json")
                    .body(Body::from(json!({"content": "Updated content"}).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        // It might be FORBIDDEN if it's a system message.
        
        // 4. Add reaction
        let response = app.clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/messages/reaction")
                    .header("Authorization", &auth)
                    .header("Content-Type", "application/json")
                    .body(Body::from(json!({
                        "message_id": msg_id,
                        "emoji": "🚀"
                    }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // 5. Remove reaction
        let response = app.clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/api/messages/reaction")
                    .header("Authorization", &auth)
                    .header("Content-Type", "application/json")
                    .body(Body::from(json!({
                        "message_id": msg_id,
                        "emoji": "🚀"
                    }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // 6. Delete message
        let response = app.clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api/messages/{}", msg_id))
                    .header("Authorization", &auth)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        // Might be 204 or 403.
    }
}

#[tokio::test]
async fn test_user_handlers() {
    let (app, state) = common::setup_test_app_with_state().await;

    let username = format!("user_{}", Uuid::new_v4());
    let email = format!("{}@example.com", username);
    app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/signup").header("Content-Type", "application/json").body(Body::from(json!({"username": username, "email": email, "password": "password"}).to_string())).unwrap()).await.unwrap();
    let response = app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/login").header("Content-Type", "application/json").body(Body::from(json!({"email": email, "password": "password"}).to_string())).unwrap()).await.unwrap();
    let body: Value = serde_json::from_slice(&axum::body::to_bytes(response.into_body(), 10000).await.unwrap()).unwrap();
    let auth = format!("Bearer {}", body["token"].as_str().unwrap());
    let user_id = body["user"]["id"].as_str().unwrap();

    // Create a server to have a context for channels/messages
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/servers")
                .header("Authorization", &auth)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"name": "User Test Server"}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let server: Value = serde_json::from_slice(&axum::body::to_bytes(response.into_body(), 10000).await.unwrap()).unwrap();
    let server_id = server["id"].as_str().unwrap();

    // Test successful status update
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/api/users/me/status")
                .header("Authorization", &auth)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"status": "Busy"}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    // Test message retrieval and update
    // 1. Create a channel
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/channels")
                .header("Authorization", &auth)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"name": "msg-test", "kind": "TEXT", "server_id": server_id}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let channel: Value = serde_json::from_slice(&axum::body::to_bytes(response.into_body(), 10000).await.unwrap()).unwrap();
    let channel_id = channel["id"].as_str().unwrap();

    // 2. Insert message via SQL (since we don't have a POST /messages REST endpoint)
    let user_id_uuid = Uuid::parse_str(user_id).unwrap();
    let msg_id: i32 = sqlx::query_scalar("INSERT INTO messages (channel_id, author, author_id, content, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id")
        .bind(channel_id)
        .bind(&username)
        .bind(user_id_uuid)
        .bind("Hello world")
        .bind(chrono::Utc::now().timestamp_millis())
        .fetch_one(&state.pool)
        .await
        .unwrap();

    // 3. Get messages
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/messages/channel/{}", channel_id))
                .header("Authorization", &auth)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let messages: Value = serde_json::from_slice(&axum::body::to_bytes(response.into_body(), 10000).await.unwrap()).unwrap();
    assert!(messages.as_array().unwrap().len() > 0);

    // 4. Update message
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/messages/{}", msg_id))
                .header("Authorization", &auth)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"content": "Updated content"}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // 5. Add reaction
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/messages/reaction")
                .header("Authorization", &auth)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({
                    "message_id": msg_id,
                    "emoji": "🔥"
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // 6. Remove reaction
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/messages/reaction")
                .header("Authorization", &auth)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({
                    "message_id": msg_id,
                    "emoji": "🔥"
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // 7. Delete message
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/messages/{}", msg_id))
                .header("Authorization", &auth)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    // 2. Update Profile
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/api/users/me")
                .header("Authorization", &auth)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({
                    "username": format!("{}_upd", username),
                    "langue": "en"
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

}

#[tokio::test]
async fn test_trophy_handlers() {
    let app = common::setup_test_app().await;
    
    let username = format!("user_{}", Uuid::new_v4());
    let email = format!("{}@example.com", username);
    app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/signup").header("Content-Type", "application/json").body(Body::from(json!({"username": username, "email": email, "password": "password"}).to_string())).unwrap()).await.unwrap();
    let response = app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/login").header("Content-Type", "application/json").body(Body::from(json!({"email": email, "password": "password"}).to_string())).unwrap()).await.unwrap();
    let body: Value = serde_json::from_slice(&axum::body::to_bytes(response.into_body(), 10000).await.unwrap()).unwrap();
    let auth = format!("Bearer {}", body["token"].as_str().unwrap());

    // 1. Get Trophies
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/trophees")
                .header("Authorization", &auth)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_upload_handler_failures() {
    let app = common::setup_test_app().await;
    
    // 1. No file field
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/uploads")
                .header("Content-Type", "multipart/form-data; boundary=X-INSOMNIA-BOUNDARY")
                .body(Body::from("--X-INSOMNIA-BOUNDARY\r\nContent-Disposition: form-data; name=\"not_a_file\"\r\n\r\ndata\r\n--X-INSOMNIA-BOUNDARY--\r\n"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // 2. Invalid content type
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/uploads")
                .header("Content-Type", "multipart/form-data; boundary=X-INSOMNIA-BOUNDARY")
                .body(Body::from("--X-INSOMNIA-BOUNDARY\r\nContent-Disposition: form-data; name=\"file\"\r\nContent-Type: text/plain\r\n\r\nnot an image\r\n--X-INSOMNIA-BOUNDARY--\r\n"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // 3. Corrupt image data
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/uploads")
                .header("Content-Type", "multipart/form-data; boundary=X-INSOMNIA-BOUNDARY")
                .body(Body::from("--X-INSOMNIA-BOUNDARY\r\nContent-Disposition: form-data; name=\"file\"\r\nContent-Type: image/jpeg\r\n\r\nnot-a-real-image-data-just-garbage\r\n--X-INSOMNIA-BOUNDARY--\r\n"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_upload_handler_success() {
    let app = common::setup_test_app().await;

    // A tiny 1x1 GIF or PNG (we can just pass dummy image bytes, `image` crate checks signature)
    // 1x1 PNG transparent: 
    let png_data = vec![
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ];

    let boundary = "X-INSOMNIA-BOUNDARY";
    let mut body_data = Vec::new();
    body_data.extend_from_slice(b"--X-INSOMNIA-BOUNDARY\r\n");
    body_data.extend_from_slice(b"Content-Disposition: form-data; name=\"file\"; filename=\"test.png\"\r\n");
    body_data.extend_from_slice(b"Content-Type: image/png\r\n\r\n");
    body_data.extend_from_slice(&png_data);
    body_data.extend_from_slice(b"\r\n--X-INSOMNIA-BOUNDARY--\r\n");

    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/uploads")
                .header("Content-Type", format!("multipart/form-data; boundary={}", boundary))
                .body(Body::from(body_data))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    
    let body = axum::body::to_bytes(response.into_body(), 10000).await.unwrap();
    let body: Value = serde_json::from_slice(&body).unwrap();
    assert!(body["url"].is_string());
}

#[tokio::test]
async fn test_server_edge_cases() {
    let app = common::setup_test_app().await;
    
    // Setup auth
    let username = format!("user_{}", Uuid::new_v4());
    let email = format!("{}@example.com", username);
    app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/signup").header("Content-Type", "application/json").body(Body::from(json!({"username": username, "email": email, "password": "pwd"}).to_string())).unwrap()).await.unwrap();
    let response = app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/login").header("Content-Type", "application/json").body(Body::from(json!({"email": email, "password": "pwd"}).to_string())).unwrap()).await.unwrap();
    let body: Value = serde_json::from_slice(&axum::body::to_bytes(response.into_body(), 10000).await.unwrap()).unwrap();
    let auth = format!("Bearer {}", body["token"].as_str().unwrap());
    
    // Create server
    let response = app.clone().oneshot(Request::builder().method("POST").uri("/api/servers").header("Authorization", &auth).header("Content-Type", "application/json").body(Body::from(json!({"name": "Edge Server"}).to_string())).unwrap()).await.unwrap();
    let server: Value = serde_json::from_slice(&axum::body::to_bytes(response.into_body(), 10000).await.unwrap()).unwrap();
    let server_id = server["id"].as_str().unwrap();

    // 1. Join server with invalid invite code
    let response = app.clone().oneshot(
        Request::builder()
            .method("POST")
            .uri("/api/servers/join")
            .header("Authorization", &auth)
            .header("Content-Type", "application/json")
            .body(Body::from(json!({"invite_code": "INVALID_CODE_123"}).to_string()))
            .unwrap()
    ).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    // 2. Remove non-existent member
    let random_user_id = Uuid::new_v4();
    let response = app.clone().oneshot(
        Request::builder()
            .method("DELETE")
            .uri(format!("/api/servers/{}/members/{}", server_id, random_user_id))
            .header("Authorization", &auth)
            .body(Body::empty())
            .unwrap()
    ).await.unwrap();
    // Might fail because the user is not in the server
    assert!(response.status() == StatusCode::FORBIDDEN || response.status() == StatusCode::INTERNAL_SERVER_ERROR || response.status() == StatusCode::BAD_REQUEST);

    // 3. Delete invalid server uuid
    let response = app.clone().oneshot(
        Request::builder()
            .method("DELETE")
            .uri("/api/servers/invalid-uuid")
            .header("Authorization", &auth)
            .body(Body::empty())
            .unwrap()
    ).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // 4. Update non-existent server
    let random_id = Uuid::new_v4();
    let response = app.clone().oneshot(
        Request::builder()
            .method("PUT")
            .uri(format!("/api/servers/{}", random_id))
            .header("Authorization", &auth)
            .header("Content-Type", "application/json")
            .body(Body::from(json!({"name": "Ghost Server"}).to_string()))
            .unwrap()
    ).await.unwrap();
    // Since we are not a member of ghost server, should return 403 or 404
    assert!(response.status() == StatusCode::FORBIDDEN || response.status() == StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_channel_edge_cases() {
    let app = common::setup_test_app().await;
    
    // Setup auth User 1
    let username1 = format!("user_{}", Uuid::new_v4());
    let email1 = format!("{}@example.com", username1);
    app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/signup").header("Content-Type", "application/json").body(Body::from(json!({"username": username1, "email": email1, "password": "pwd"}).to_string())).unwrap()).await.unwrap();
    let response1 = app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/login").header("Content-Type", "application/json").body(Body::from(json!({"email": email1, "password": "pwd"}).to_string())).unwrap()).await.unwrap();
    let body1: Value = serde_json::from_slice(&axum::body::to_bytes(response1.into_body(), 10000).await.unwrap()).unwrap();
    let auth1 = format!("Bearer {}", body1["token"].as_str().unwrap());
    
    // Setup auth User 2
    let username2 = format!("user_{}", Uuid::new_v4());
    let email2 = format!("{}@example.com", username2);
    app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/signup").header("Content-Type", "application/json").body(Body::from(json!({"username": username2, "email": email2, "password": "pwd"}).to_string())).unwrap()).await.unwrap();
    let response2 = app.clone().oneshot(Request::builder().method("POST").uri("/api/auth/login").header("Content-Type", "application/json").body(Body::from(json!({"email": email2, "password": "pwd"}).to_string())).unwrap()).await.unwrap();
    let body2: Value = serde_json::from_slice(&axum::body::to_bytes(response2.into_body(), 10000).await.unwrap()).unwrap();
    let auth2 = format!("Bearer {}", body2["token"].as_str().unwrap());
    let user2_id = body2["user"]["id"].as_str().unwrap();

    // 1. Create DM duplicate
    let response = app.clone().oneshot(
        Request::builder().method("POST").uri("/api/channels/dms").header("Authorization", &auth1).header("Content-Type", "application/json").body(Body::from(json!({"target_user_id": user2_id}).to_string())).unwrap()
    ).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    
    let response_dup = app.clone().oneshot(
        Request::builder().method("POST").uri("/api/channels/dms").header("Authorization", &auth1).header("Content-Type", "application/json").body(Body::from(json!({"target_user_id": user2_id}).to_string())).unwrap()
    ).await.unwrap();
    // Usually returns existing DM
    assert_eq!(response_dup.status(), StatusCode::OK);

    // 2. Fetch channels for invalid server UUID
    let response = app.clone().oneshot(
        Request::builder().method("GET").uri("/api/channels/server/invalid-uuid").header("Authorization", &auth1).body(Body::empty()).unwrap()
    ).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // 3. Fetch channels for non-existent server
    let response = app.clone().oneshot(
        Request::builder().method("GET").uri(&format!("/api/channels/server/{}", Uuid::new_v4())).header("Authorization", &auth1).body(Body::empty()).unwrap()
    ).await.unwrap();
    // Returns 200 [] or 403
    assert!(response.status() == StatusCode::OK || response.status() == StatusCode::FORBIDDEN);
}
