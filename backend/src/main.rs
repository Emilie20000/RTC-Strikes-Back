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
use axum::http::{HeaderValue, Method};
use sqlx::postgres::{PgPool, PgPoolOptions};
use serde::Serialize;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
// use tower_http::services::ServeDir;
use dotenvy::dotenv;
use std::env;
use socketioxide::SocketIo;
use dashmap::DashMap;
use serde::Deserialize;

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
    
    println!("Configuring CORS for explicit origins...");

    let (socket_layer, io) = SocketIo::builder()
        .with_state(pool.clone())
        .with_state(Arc::new(DashMap::<String, VoiceState>::new()))
        .ping_interval(std::time::Duration::from_secs(15))
        .ping_timeout(std::time::Duration::from_secs(30))
        .build_layer();
    
    io.ns("/", socket::on_connect);

    let state = Arc::new(AppState { 
        pool, 
        io: io.clone(),
        voice_users: Arc::new(DashMap::new())
    });

use tower_http::services::ServeDir;


    if let Err(e) = tokio::fs::create_dir_all("uploads").await {
        println!("Failed to create uploads directory: {}", e);
    }

    let app = Router::new()
        .route("/", get(root))
        .route("/api/hello", get(hello_world))
        .route("/api/db-check", get(db_check))
        .route("/api/uploads", axum::routing::post(handlers::upload::upload_file))
        .nest_service("/uploads", ServeDir::new("uploads"))
        .nest("/api/auth", routes::auth::auth_routes(state.clone()))
        .nest("/api/servers", routes::server::server_routes(state.clone()))
        .nest("/api/channels", routes::channel::channel_routes(state.clone()))
        .nest("/api/messages", routes::messages::message_routes(state.clone()))
        .nest("/api/users", routes::user::user_routes(state.clone()))
        .layer(socket_layer)
        .with_state(state.clone())
        .layer(
            CorsLayer::new()
                .allow_origin([
                    HeaderValue::from_static("http://localhost:3000"),
                    HeaderValue::from_static("http://127.0.0.1:3000"),
                    HeaderValue::from_static("http://localhost:3001"),
                    HeaderValue::from_static("http://127.0.0.1:3001"),
                    HeaderValue::from_static("http://localhost:5173"),
                    HeaderValue::from_static("http://127.0.0.1:5173"),
                ])
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE, Method::OPTIONS])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                    axum::http::header::ACCEPT,
                ])
                .allow_credentials(true),
        )
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
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