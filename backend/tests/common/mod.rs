use sqlx::PgPool;
use std::sync::Arc;
use dashmap::DashMap;
use socketioxide::SocketIo;
use backend::{AppState, create_router};
use axum::Router;

pub async fn setup_test_app() -> Router {
    let (router, _) = setup_test_app_with_state().await;
    router
}

pub async fn setup_test_app_with_state() -> (Router, Arc<AppState>) {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await.unwrap();

    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let redis_client = redis::Client::open(redis_url).unwrap();

    let (_socket_layer, io) = SocketIo::builder().build_layer();
    io.ns("/", |_socket: socketioxide::extract::SocketRef| async move {});

    let state = Arc::new(AppState {
        pool,
        io,
        voice_users: Arc::new(DashMap::new()),
        redis_client,
    });

    (create_router(state.clone()), state)
}
