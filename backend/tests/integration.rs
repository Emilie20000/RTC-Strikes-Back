use sqlx::PgPool;
use uuid::Uuid;
use backend::models::server::CreateServer;
use backend::services::server::{create_server, get_user_servers};

async fn get_test_pool() -> PgPool {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    PgPool::connect(&database_url).await.unwrap()
}

#[tokio::test]
async fn test_server_lifecycle() {
    let pool = get_test_pool().await;
    let owner_id = Uuid::new_v4();
    
    // Create a dummy user first because of foreign key constraints
    sqlx::query("INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)")
        .bind(owner_id)
        .bind(format!("testuser_{}", owner_id))
        .bind(format!("test_{}@example.com", owner_id))
        .bind("hash")
        .execute(&pool)
        .await.unwrap();

    let payload = CreateServer {
        name: "Test Server".to_string(),
        description: Some("Description".to_string()),
        is_public: Some(true),
    };

    // Test Create
    let server = create_server(&pool, owner_id, payload).await.expect("Failed to create server");
    assert_eq!(server.name, "Test Server");
    assert_eq!(server.owner_id, owner_id);

    // Test Get
    let servers = get_user_servers(&pool, owner_id).await.expect("Failed to get servers");
    assert!(servers.iter().any(|s| s.id == server.id));
}
