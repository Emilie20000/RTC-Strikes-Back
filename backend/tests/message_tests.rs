use sqlx::PgPool;
use uuid::Uuid;
use backend::services::message::*;
use backend::models::channel::ChannelType;

async fn get_test_pool() -> PgPool {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    PgPool::connect(&database_url).await.unwrap()
}

async fn create_test_user(pool: &PgPool) -> Uuid {
    let user_id = Uuid::new_v4();
    let username = format!("user_{}", &user_id.to_string()[..8]);
    sqlx::query("INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind(&username)
        .bind(format!("{}@example.com", username))
        .bind("hash")
        .execute(pool)
        .await
        .unwrap();
    user_id
}

async fn setup_test_channel(pool: &PgPool) -> (Uuid, Uuid, String) {
    let user_id = create_test_user(pool).await;
    let username = sqlx::query_scalar::<_, String>("SELECT username FROM users WHERE id = $1").bind(user_id).fetch_one(pool).await.unwrap();
    
    let server_id = Uuid::new_v4();
    sqlx::query("INSERT INTO servers (id, name, owner_id, invite_code) VALUES ($1, $2, $3, $4)")
        .bind(server_id)
        .bind("Test Server")
        .bind(user_id)
        .bind(format!("INV_{}", &server_id.to_string()[..8]))
        .execute(pool)
        .await
        .unwrap();

    let channel_id = Uuid::new_v4();
    sqlx::query("INSERT INTO channels (id, name, kind, server_id) VALUES ($1, $2, $3, $4)")
        .bind(channel_id)
        .bind("general")
        .bind(ChannelType::Text)
        .bind(server_id)
        .execute(pool)
        .await
        .unwrap();
    
    (channel_id, user_id, username)
}

#[tokio::test]
async fn test_message_operations() {
    let pool = get_test_pool().await;
    let (channel_id, _user_id, username) = setup_test_channel(&pool).await;

    // 1. Create Message
    let message = create_message(&pool, &channel_id.to_string(), &username, Some(_user_id), "Hello tests!")
        .await
        .expect("Failed to create message");
    assert_eq!(message.content, "Hello tests!");

    // 2. Get Messages
    let messages = get_channel_messages(&pool, &channel_id.to_string(), 50).await.expect("Failed to get messages");
    assert!(messages.iter().any(|m| m.id == message.id));

    // 3. Delete Message
    delete_message(&pool, message.id).await.expect("Failed to delete message");
    let after_delete = get_channel_messages(&pool, &channel_id.to_string(), 50).await.expect("Check after delete");
    assert!(!after_delete.iter().any(|m| m.id == message.id));
}
