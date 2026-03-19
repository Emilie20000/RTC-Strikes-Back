pub mod models;
mod services;
mod handlers;
mod routes;
mod middleware;
mod socket;

use axum::{
    routing::get,
    Router,
    Json,
};
use axum::http::{HeaderValue, Method, StatusCode, header};
use axum::middleware::Next;
use axum::middleware::from_fn;
use axum::extract::Request;
use sqlx::postgres::{PgPool, PgPoolOptions};
use serde::Serialize;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use dashmap::DashMap;
use serde::Deserialize;
use tower_http::services::ServeDir;
use dotenvy::dotenv;
use std::env;
use socketioxide::SocketIo;

#[derive(Serialize)]
struct Message {
    message: String,
}

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
    pub io: socketioxide::SocketIo,
    pub voice_users: Arc<DashMap<String, VoiceState>>,
    pub redis_client: redis::Client,
}

use std::time::Duration;
use tokio::time::sleep;

#[tokio::main]
async fn main() {
    dotenv().ok();
    tracing_subscriber::fmt::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let mut retries = 5;
    let mut pool = None;

    while retries > 0 {
        match PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await 
        {
            Ok(p) => {
                pool = Some(p);
                break;
            }
            Err(e) => {
                println!("❌ Failed to connect to database: {}. Retrying in 5 seconds...", e);
                sleep(Duration::from_secs(5)).await;
                retries -= 1;
            }
        }
    }

    let pool = pool.expect("Failed to create pool after multiple retries");
    
    match sqlx::query("SELECT 1").execute(&pool).await {
        Ok(_) => println!("Successfully connected to PostgreSQL!"),
        Err(e) => println!("Failed to verify PostgreSQL connection: {}", e),
    }

    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    println!("Connecting to Redis at {}...", redis_url);
    let redis_client = redis::Client::open(redis_url).expect("Invalid Redis URL");
    
    match redis_client.get_connection() {
        Ok(_) => println!("Connected to Redis!"),
        Err(e) => println!("Failed to connect to Redis: {}", e),
    }
    
    println!("Configuring CORS...");
    let allowed_origins_str = env::var("ALLOWED_ORIGINS").unwrap_or_else(|_| "http://localhost:3000,tauri://localhost,https://tauri.localhost".to_string());
    let allowed_origins: Vec<HeaderValue> = allowed_origins_str
        .split(',')
        .map(|s| s.trim().trim_matches(|c: char| c == '"' || c == '\''))
        .filter(|s| !s.is_empty())
        .map(|s| {
            println!("   -> Adding origin: {}", s);
            s.parse::<HeaderValue>().expect("Invalid origin")
        })
        .collect();
    
    println!("CORS configured with {} origins.", allowed_origins.len());

    let voice_users = Arc::new(DashMap::<String, VoiceState>::new());

    let (socket_layer, io) = SocketIo::builder()
        .with_state(pool.clone())
        .with_state(redis_client.clone())
        .with_state(voice_users.clone())
        .ping_interval(std::time::Duration::from_secs(15))
        .ping_timeout(std::time::Duration::from_secs(30))
        .build_layer();
    
    io.ns("/", socket::on_connect);

    let state = Arc::new(AppState { 
        pool, 
        io: io.clone(),
        voice_users,
        redis_client,
    });

    if let Err(e) = tokio::fs::create_dir_all("uploads").await {
        println!("Failed to create uploads directory: {}", e);
    }

    let app = Router::new()
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
        .with_state(state.clone())
        .fallback(handle_404)
        .layer(socket_layer)
        .layer(
            CorsLayer::new()
                .allow_origin(allowed_origins.clone())
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::DELETE,
                    Method::OPTIONS,
                    Method::PATCH,
                ])
                .allow_headers([
                    header::AUTHORIZATION,
                    header::CONTENT_TYPE,
                    header::ACCEPT,
                    header::ORIGIN,
                    header::ACCESS_CONTROL_REQUEST_METHOD,
                    header::ACCESS_CONTROL_REQUEST_HEADERS,
                ])
                .allow_credentials(true),
        )
        .layer(from_fn(|req: Request, next: Next| async move {
            if let Some(origin) = req.headers().get(header::ORIGIN) {
                println!("🔍 Incoming request from origin: {:?}", origin);
            }
            next.run(req).await
        }))
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(state);

    let port = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("🚀 Server listening on {}", addr);
    println!("📚 Available routes:");
    println!("   GET  /");
    println!("   GET  /api/hello");
    println!("   GET  /api/db-check");
    println!("   POST /api/auth/signup");
    println!("   POST /api/auth/login");
    println!("   GET  /api/auth/me (requires auth)");
    println!("   POST /api/servers (create server)");
    println!("   GET  /api/servers (get my servers)");
    println!("   POST /api/servers/join (join server)");
    println!("   GET  /api/servers/:id");
    println!("   PUT  /api/servers/:id");
    println!("   DELETE /api/servers/:id");
    println!("   DELETE /api/servers/:id/members/:user_id");
    println!("   PUT    /api/servers/:id/members/:user_id/role");
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn root() -> &'static str {
    "🦀 RTC Backend API - Rust + PostgreSQL"
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

async fn handle_404(request: axum::extract::Request) -> (StatusCode, Json<serde_json::Value>) {
    let method = request.method().clone();
    let path = request.uri().path().to_string();
    println!("⚠️  404 error: {} {}", method, path);
    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": format!("Route not found: {} {}", method, path) })),
    )
}