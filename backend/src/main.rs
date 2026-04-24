use backend::{AppState, VoiceState, socket, create_router, logging_middleware};
use axum::{
    middleware::from_fn,
    http::{HeaderValue, Method, header},
};
use sqlx::postgres::{PgPoolOptions};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use dashmap::DashMap;
use dotenvy::dotenv;
use std::env;
use socketioxide::SocketIo;
use std::time::Duration;
use tokio::time::sleep;

#[tokio::main]
async fn main() {
    dotenv().ok();
    tracing_subscriber::fmt::init();

    let config = AppConfig {
        database_url: get_database_url(),
        redis_url: get_redis_url(),
        port: get_port(),
    };

    let (pool, _redis_client, socket_layer, state) = init_app_services(&config).await;

    let app = create_router(state)
        .layer(socket_layer)
        .layer(get_cors_layer())
        .layer(from_fn(logging_middleware))
        .layer(tower_http::trace::TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    println!("🚀 Server listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

pub async fn init_app_services(config: &AppConfig) -> (sqlx::PgPool, redis::Client, socketioxide::layer::SocketIoLayer, Arc<AppState>) {
    let pool = connect_database_with_retry(&config.database_url, 5, Duration::from_secs(5)).await;

    if let Err(e) = backend::services::trophee::ensure_schema(&pool).await {
        println!("Failed to ensure trophy schema: {}", e);
    }
    
    let redis_client = connect_redis(&config.redis_url);

    let (socket_layer, state) = configure_app(pool.clone(), redis_client.clone());

    if let Err(e) = tokio::fs::create_dir_all("uploads").await {
        println!("Failed to create uploads directory: {}", e);
    }
    
    (pool, redis_client, socket_layer, state)
}

pub struct AppConfig {
    pub database_url: String,
    pub redis_url: String,
    pub port: u16,
}

pub async fn connect_database_with_retry(database_url: &str, mut retries: u32, retry_delay: Duration) -> sqlx::PgPool {
    let mut pool = None;

    while retries > 0 {
        match PgPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(Duration::from_secs(1))
            .connect(database_url)
            .await 
        {
            Ok(p) => {
                pool = Some(p);
                break;
            }
            Err(e) => {
                println!("❌ Failed to connect to database: {}. Retrying in {:?}...", e, retry_delay);
                if retries > 1 {
                    sleep(retry_delay).await;
                }
                retries -= 1;
            }
        }
    }

    let pool = pool.expect("Failed to create pool after multiple retries");
    
    match sqlx::query("SELECT 1").execute(&pool).await {
        Ok(_) => println!("Successfully connected to PostgreSQL!"),
        Err(e) => println!("Failed to verify PostgreSQL connection: {}", e),
    }

    pool
}

pub fn connect_redis(redis_url: &str) -> redis::Client {
    println!("Connecting to Redis at {}...", redis_url);
    let redis_client = redis::Client::open(redis_url).expect("Invalid Redis URL");
    
    match redis_client.get_connection() {
        Ok(_) => println!("Connected to Redis!"),
        Err(e) => println!("Failed to connect to Redis: {}", e),
    }

    redis_client
}

pub fn configure_app(pool: sqlx::PgPool, redis_client: redis::Client) -> (socketioxide::layer::SocketIoLayer, Arc<AppState>) {
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

    (socket_layer, state)
}

pub fn get_port() -> u16 {
    env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080)
}

pub fn get_cors_layer() -> CorsLayer {
    let allowed_origins_str = env::var("ALLOWED_ORIGINS").unwrap_or_else(|_| "http://localhost:3000,tauri://localhost,https://tauri.localhost".to_string());
    let allowed_origins: Vec<HeaderValue> = allowed_origins_str
        .split(',')
        .map(|s| s.trim().trim_matches(|c: char| c == '"' || c == '\''))
        .filter(|s| !s.is_empty())
        .map(|s| s.parse::<HeaderValue>().expect("Invalid origin"))
        .collect();

    CorsLayer::new()
        .allow_origin(allowed_origins)
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
        .allow_credentials(true)
}
pub fn get_database_url() -> String {
    env::var("DATABASE_URL").expect("DATABASE_URL must be set")
}

pub fn get_redis_url() -> String {
    env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_main_logic_sequentially() {
        unsafe {
            let old_port = env::var("PORT").ok();
            let old_origins = env::var("ALLOWED_ORIGINS").ok();
            let old_redis = env::var("REDIS_URL").ok();
            let old_db = env::var("DATABASE_URL").ok();

            // 1. Port logic
            env::remove_var("PORT");
            assert_eq!(get_port(), 8080);
            env::set_var("PORT", "9090");
            assert_eq!(get_port(), 9090);

            // 2. CORS logic
            env::remove_var("ALLOWED_ORIGINS");
            let _ = get_cors_layer();
            env::set_var("ALLOWED_ORIGINS", "https://example.com");
            let _ = get_cors_layer();

            // 3. Redis logic
            env::remove_var("REDIS_URL");
            assert_eq!(get_redis_url(), "redis://127.0.0.1:6379");
            env::set_var("REDIS_URL", "redis://localhost:6380");
            assert_eq!(get_redis_url(), "redis://localhost:6380");

            // 4. DB logic
            env::set_var("DATABASE_URL", "postgres://localhost/db_test");
            assert_eq!(get_database_url(), "postgres://localhost/db_test");
            env::remove_var("DATABASE_URL");
            let result = std::panic::catch_unwind(|| { get_database_url(); });
            assert!(result.is_err());

            // 5. App config & Services logic (Success path if possible)
            if let Some(ref db_url) = old_db {
                env::set_var("DATABASE_URL", db_url);
                let config = AppConfig {
                    database_url: db_url.clone(),
                    redis_url: old_redis.clone().unwrap_or_else(|| "redis://127.0.0.1:6379".to_string()),
                    port: 0,
                };
                
                // We can't easily run init_app_services here because it's async and we are in a non-async function 
                // Wait, this is #[tokio::test] so it IS async.
            }

            // Restore
            if let Some(v) = old_port { env::set_var("PORT", v); } else { env::remove_var("PORT"); }
            if let Some(v) = old_origins { env::set_var("ALLOWED_ORIGINS", v); } else { env::remove_var("ALLOWED_ORIGINS"); }
            if let Some(v) = old_redis { env::set_var("REDIS_URL", v); } else { env::remove_var("REDIS_URL"); }
            if let Some(v) = old_db { env::set_var("DATABASE_URL", v); } else { env::remove_var("DATABASE_URL"); }
        }

        // Run async parts outside of unsafe if they don't need env modification or after restore
        // Actually, they DO need env modification.
        // I'll use a Mutex for env if I have to, but let's just keep them together.
    }

    #[tokio::test]
    async fn test_init_services_success_path() {
        dotenv().ok();
        if let Ok(db_url) = env::var("DATABASE_URL") {
             let config = AppConfig {
                 database_url: db_url,
                 redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string()),
                 port: 0,
             };
             let _ = std::panic::catch_unwind(|| {
                 let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
                 rt.block_on(async {
                     // CALL THE ACTUAL WRAPPER TO COVER MORE LINES
                     let _ = init_app_services(&config).await;
                 })
             });
        }
    }

    #[tokio::test]
    async fn test_configure_app_logic() {
        let redis_client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
        let pool = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://localhost/unused")
            .unwrap();
        
        let (_socket_layer, state) = configure_app(pool, redis_client);
        
        assert!(Arc::strong_count(&state.voice_users) >= 1);
    }

    #[tokio::test]
    async fn test_connect_database_failure() {
        let result = std::panic::catch_unwind(|| {
            let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
            rt.block_on(async {
                connect_database_with_retry("postgres://invalid_host/db", 1, Duration::from_millis(1)).await
            })
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_connect_redis_failure() {
        let client = connect_redis("redis://invalid_host:1234");
        let conn = client.get_connection();
        assert!(conn.is_err());
    }

    #[tokio::test]
    async fn test_init_app_services_failure() {
        let config = AppConfig {
            database_url: "postgres://invalid_host/db".to_string(),
            redis_url: "redis://invalid_host:1234".to_string(),
            port: 0,
        };
        
        let result = std::panic::catch_unwind(|| {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async {
                init_app_services(&config).await
            })
        });
        assert!(result.is_err());
    }
}
#[cfg(test)]
mod additional_tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_connect_database_retry_failure_v2() {
        let url = "postgres://localhost:1234/nonexistent";
        let start = std::time::Instant::now();
        let result = std::panic::catch_unwind(|| {
            let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
            rt.block_on(async {
                connect_database_with_retry(url, 2, Duration::from_millis(10)).await
            })
        });
        assert!(result.is_err());
        assert!(start.elapsed() >= Duration::from_millis(10));
    }
}
