use backend::models::user::User;
use std::time::Duration;
use serde_json::json;
use tokio::net::TcpListener;
use rust_socketio::{asynchronous::{ClientBuilder, Client}, Payload};
use futures::future::BoxFuture;

#[tokio::test]
async fn test_socket_handlers_integration() {
    dotenvy::dotenv().ok();
    // 1. Setup Database and Services
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = sqlx::PgPool::connect(&database_url).await.unwrap();

    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let redis_client = redis::Client::open(redis_url).unwrap();

    let voice_users = std::sync::Arc::new(dashmap::DashMap::new());

    let (socket_layer, io) = socketioxide::SocketIo::builder()
        .with_state(pool.clone())
        .with_state(redis_client.clone())
        .with_state(voice_users.clone())
        .build_layer();

    io.ns("/", backend::socket::on_connect);

    let state = std::sync::Arc::new(backend::AppState {
        pool: pool.clone(),
        io,
        voice_users,
        redis_client,
    });

    let app = backend::create_router(state).layer(socket_layer);
        
    // 2. Start server on an ephemeral port
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://127.0.0.1:{}", addr.port());
    
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    
    // Give server a moment to start
    tokio::time::sleep(Duration::from_millis(500)).await;
    
    // 3. Create a dummy user, server, and channel for testing
    let username = format!("socketuser_{}", uuid::Uuid::new_v4());
    let email = format!("{}@test.com", username);
    let pwd_hash = backend::services::auth::hash_password("pwd").unwrap();
    
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(&username)
    .bind(&email)
    .bind(&pwd_hash)
    .fetch_one(&pool)
    .await
    .unwrap();
    
    let server_id = uuid::Uuid::new_v4();
    let invite_code = uuid::Uuid::new_v4().to_string()[..10].to_string();
    let _ = sqlx::query("INSERT INTO servers (id, name, owner_id, invite_code) VALUES ($1, $2, $3, $4)")
        .bind(server_id)
        .bind("Socket Test Server")
        .bind(user.id)
        .bind(invite_code)
        .execute(&pool)
        .await
        .unwrap();

    let _ = sqlx::query("INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'OWNER')")
        .bind(server_id)
        .bind(user.id)
        .execute(&pool)
        .await
        .unwrap();
        
    let channel_id = uuid::Uuid::new_v4();
    let _ = sqlx::query("INSERT INTO channels (id, name, server_id, kind) VALUES ($1, $2, $3, 'TEXT')")
        .bind(channel_id)
        .bind("socket-chan")
        .bind(server_id)
        .execute(&pool)
        .await
        .unwrap();

    // 4. Connect the socket client
    let callback = |payload: Payload, _: Client| -> BoxFuture<'static, ()> {
        Box::pin(async move {
            println!("Received message: {:?}", payload);
        })
    };
    
    let err_callback = |err: Payload, _: Client| -> BoxFuture<'static, ()> {
        Box::pin(async move {
            eprintln!("Error: {:#?}", err);
        })
    };

    let client = ClientBuilder::new(url.clone())
        .namespace("/")
        .on("error", err_callback)
        .on("message", callback)
        .connect()
        .await
        .expect("Failed to connect to socket server");

    tokio::time::sleep(Duration::from_millis(500)).await;

    // 5. Emit events to hit handle_* functions
    
    // identify
    let _ = client.emit("identify", json!(user.id.to_string())).await;
    
    // join_voice
    let _ = client.emit("join_voice", json!({
        "channelId": channel_id.to_string(),
        "userId": user.id.to_string(),
        "serverId": server_id.to_string()
    })).await;
    
    // voice_mute
    let _ = client.emit("voice_mute", json!({
        "channelId": channel_id.to_string(),
        "userId": user.id.to_string(),
        "serverId": server_id.to_string(),
        "muted": true
    })).await;
    
    // offer, answer, ice_candidate
    let _ = client.emit("offer", json!({
        "targetUserId": user.id.to_string(),
        "signal": {"type": "offer"},
        "senderId": user.id.to_string()
    })).await;
    let _ = client.emit("answer", json!({
        "targetUserId": user.id.to_string(),
        "signal": {"type": "answer"},
        "senderId": user.id.to_string()
    })).await;
    let _ = client.emit("ice_candidate", json!({
        "targetUserId": user.id.to_string(),
        "signal": {"candidate": "candidate"},
        "senderId": user.id.to_string()
    })).await;
    
    // typing / stop_typing
    let _ = client.emit("typing", json!({
        "channelId": channel_id.to_string(),
        "author": user.username,
        "userId": user.id.to_string(),
        "avatarUrl": null
    })).await;
    let _ = client.emit("stop_typing", json!({
        "channelId": channel_id.to_string(),
        "author": user.username,
        "userId": user.id.to_string()
    })).await;
    
    // send_message
    let _ = client.emit("send_message", json!({
        "channelId": channel_id.to_string(),
        "author": user.username,
        "authorId": user.id.to_string(),
        "content": "Socket test message!"
    })).await;
    
    tokio::time::sleep(Duration::from_millis(1000)).await; // wait for message to be saved
    
    let msg_id: i32 = sqlx::query_scalar("SELECT id FROM messages WHERE channel_id = $1 LIMIT 1")
        .bind(channel_id.to_string())
        .fetch_one(&pool)
        .await
        .unwrap_or(1);
    
    // add_reaction
    let _ = client.emit("add_reaction", json!({
        "messageId": msg_id,
        "userId": user.id.to_string(),
        "emoji": "🎉"
    })).await;
    
    tokio::time::sleep(Duration::from_millis(500)).await;
    
    // remove_reaction
    let _ = client.emit("remove_reaction", json!({
        "messageId": msg_id,
        "userId": user.id.to_string(),
        "emoji": "🎉"
    })).await;
    
    // screen_share / camera
    let _ = client.emit("screen_share_started", json!({
        "userId": user.id.to_string(),
        "channelId": channel_id.to_string()
    })).await;
    let _ = client.emit("screen_share_stopped", json!({
        "userId": user.id.to_string(),
        "channelId": channel_id.to_string()
    })).await;
    let _ = client.emit("camera_video_started", json!({
        "userId": user.id.to_string(),
        "channelId": channel_id.to_string()
    })).await;
    let _ = client.emit("camera_video_stopped", json!({
        "userId": user.id.to_string(),
        "channelId": channel_id.to_string()
    })).await;
    
    // leave_voice
    let _ = client.emit("leave_voice", json!({
        "channelId": channel_id.to_string(),
        "userId": user.id.to_string(),
        "serverId": server_id.to_string()
    })).await;
    
    tokio::time::sleep(Duration::from_millis(500)).await;
    
    let _ = client.disconnect().await;
}
