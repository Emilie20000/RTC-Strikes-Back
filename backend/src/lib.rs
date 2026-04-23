pub mod models;
pub mod services;
pub mod handlers;
pub mod routes;
pub mod middleware;
pub mod socket;

use axum::{
    routing::get,
    Router,
    Json,
    middleware::from_fn,
    extract::Request,
    http::{StatusCode, header},
    middleware::Next,
};
use socketioxide::SocketIo;
use sqlx::PgPool;
use std::sync::Arc;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tower_http::services::ServeDir;

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VoiceState {
    pub user_id: String,
    pub username: String,
    pub avatar_url: Option<String>,
    pub channel_id: String,
    pub server_id: String,
    pub muted: bool,
    pub deafened: bool,
    #[serde(skip)]
    pub socket_id: Option<String>,
}

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub io: SocketIo,
    pub voice_users: Arc<DashMap<String, VoiceState>>,
    pub redis_client: redis::Client,
}

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(root))
        .route("/api/hello", get(hello_world))
        .route("/api/db-check", get(db_check))
        .route("/api/redis-check", get(redis_check))
        .route("/api/uploads", axum::routing::post(handlers::upload::upload_file))
        .nest_service("/uploads", ServeDir::new("uploads"))
        .nest("/api/auth", routes::auth::auth_routes(state.clone()))
        .nest("/api/servers", routes::server::server_routes(state.clone()))
        .nest("/api/channels", routes::channel::channel_routes(state.clone()))
        .nest("/api/messages", routes::messages::message_routes(state.clone()))
        .nest("/api/users", routes::user::user_routes(state.clone()))
        .nest("/api", routes::trophee::trophee_routes(state.clone()))
        .fallback(handle_404)
        .with_state(state)
}

async fn root() -> &'static str {
    "🦀 RTC Backend API - Rust + PostgreSQL"
}

#[derive(Serialize)]
struct Message {
    message: String,
}

async fn hello_world() -> Json<Message> {
    Json(Message {
        message: "Hello from Rust!".to_string(),
    })
}

async fn db_check(axum::extract::State(state): axum::extract::State<Arc<AppState>>) -> Json<Message> {
    match sqlx::query("SELECT 1").execute(&state.pool).await {
        Ok(_) => Json(Message {
            message: "✅ Connected to PostgreSQL!".to_string(),
        }),
        Err(e) => Json(Message {
            message: format!("❌ Error connecting to PostgreSQL: {}", e),
        }),
    }
}

async fn redis_check(axum::extract::State(state): axum::extract::State<Arc<AppState>>) -> Json<Message> {
    let mut conn = match state.redis_client.get_connection() {
        Ok(c) => c,
        Err(e) => return Json(Message { message: format!("❌ Redis Connection Error: {}", e) }),
    };

    let _: () = match redis::cmd("SET").arg("test_key").arg("working").query::<()>(&mut conn) {
        Ok(_) => (),
        Err(e) => return Json(Message { message: format!("❌ Redis Write Error: {}", e) }),
    };

    let val: String = match redis::cmd("GET").arg("test_key").query(&mut conn) {
        Ok(v) => v,
        Err(e) => return Json(Message { message: format!("❌ Redis Read Error: {}", e) }),
    };

    Json(Message {
        message: format!("✅ Redis is WORKING! (test_key = {})", val),
    })
}

async fn handle_404(request: Request) -> (StatusCode, Json<serde_json::Value>) {
    let method = request.method().clone();
    let path = request.uri().path().to_string();
    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": format!("Route not found: {} {}", method, path) })),
    )
}

pub async fn logging_middleware(req: Request, next: Next) -> impl axum::response::IntoResponse {
    if let Some(origin) = req.headers().get(header::ORIGIN) {
        println!("🔍 Incoming request from origin: {:?}", origin);
    }
    next.run(req).await
}
