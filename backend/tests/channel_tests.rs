use sqlx::PgPool;
use uuid::Uuid;
use backend::models::channel::{CreateChannel, ChannelType};
use backend::services::channel::*;

async fn get_test_pool() -> PgPool {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    PgPool::connect(&database_url).await.unwrap()
}

async fn create_test_user(pool: &PgPool) -> Uuid {
    let user_id = Uuid::new_v4();
    sqlx::query("INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind(format!("user_{}", user_id))
        .bind(format!("{}@example.com", user_id))
        .bind("hash")
        .execute(pool)
        .await
        .unwrap();
    user_id
}

async fn create_test_server(pool: &PgPool, owner_id: Uuid) -> Uuid {
    let server_id = Uuid::new_v4();
    sqlx::query("INSERT INTO servers (id, name, owner_id, invite_code) VALUES ($1, $2, $3, $4)")
        .bind(server_id)
        .bind("Test Server")
        .bind(owner_id)
        .bind(format!("INV_{}", &server_id.to_string()[..8]))
        .execute(pool)
        .await
        .unwrap();
    server_id
}

#[tokio::test]
async fn test_channel_crud_operations() {
    let pool = get_test_pool().await;
    let owner_id = create_test_user(&pool).await;
    let server_id = create_test_server(&pool, owner_id).await;

    // 1. Create Channel
    let payload = CreateChannel {
        name: "test-channel".to_string(),
        description: Some("Test Description".to_string()),
        kind: Some(ChannelType::Text),
        server_id,
    };

    let channel = create_channel(&pool, payload).await.expect("Failed to create channel");
    assert_eq!(channel.name.as_deref(), Some("test-channel"));

    // 2. Get Channels by Server ID
    let channels = get_channels_by_server_id(&pool, server_id).await.expect("Failed to get channels");
    assert!(channels.iter().any(|c| c.id == channel.id));

    // 3. Get Channel by ID
    let found_channel = get_channel_by_id(&pool, channel.id).await.expect("Failed to get channel by id");
    assert!(found_channel.is_some());
    assert_eq!(found_channel.unwrap().id, channel.id);

    // 4. Delete Channel
    delete_channel(&pool, channel.id).await.expect("Failed to delete channel");
    
    let deleted_channel = get_channel_by_id(&pool, channel.id).await.expect("Failed to check deletion");
    assert!(deleted_channel.is_none());
}

#[tokio::test]
async fn test_dm_channel_operations() {
    let pool = get_test_pool().await;
    let user1_id = create_test_user(&pool).await;
    let user2_id = create_test_user(&pool).await;

    // 1. Create DM Channel
    let dm_channel = create_dm_channel(&pool, user1_id, user2_id).await.expect("Failed to create DM channel");
    assert_eq!(dm_channel.kind, ChannelType::Dm);

    // 2. Re-creating same DM channel should return the same one
    let same_dm = create_dm_channel(&pool, user1_id, user2_id).await.expect("Failed to get existing DM channel");
    assert_eq!(dm_channel.id, same_dm.id);

    // 3. Get User DM Channels
    let user_dms = get_user_dm_channels(&pool, user1_id).await.expect("Failed to get user DMs");
    assert!(user_dms.iter().any(|c| c.id == dm_channel.id));
}
