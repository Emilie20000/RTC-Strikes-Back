use sqlx::PgPool;
use uuid::Uuid;
use backend::services::permission::*;

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

#[tokio::test]
async fn test_permission_logic() {
    let pool = get_test_pool().await;
    let user_id = create_test_user(&pool).await;
    let server_id = Uuid::new_v4();
    // Create server first to satisfy Foreign Key
    sqlx::query("INSERT INTO servers (id, name, owner_id, invite_code) VALUES ($1, $2, $3, $4)")
        .bind(server_id)
        .bind("Test Permission Server")
        .bind(user_id)
        .bind(format!("PRM_{}", &server_id.to_string()[..8]))
        .execute(&pool)
        .await
        .unwrap();

    // 2. Set role directly in DB for testing
    sqlx::query("INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, $3)")
        .bind(server_id)
        .bind(user_id)
        .bind(UserRole::Admin)
        .execute(&pool)
        .await
        .expect("Failed to insert member");
    
    let role = get_user_role(&pool, user_id, server_id).await.unwrap();
    assert_eq!(role, Some(UserRole::Admin));

    // 3. Update role
    sqlx::query("UPDATE server_members SET role = $1 WHERE server_id = $2 AND user_id = $3")
        .bind(UserRole::Member)
        .bind(server_id)
        .bind(user_id)
        .execute(&pool)
        .await
        .expect("Failed to update member");

    let role = get_user_role(&pool, user_id, server_id).await.unwrap();
    assert_eq!(role, Some(UserRole::Member));
}

#[tokio::test]
async fn test_deletion_permissions() {
    // Pure logic tests
    assert!(can_delete_message_check(true, None)); // Author can always delete
    assert!(can_delete_message_check(false, Some(UserRole::Owner))); // Owner can delete anything
    assert!(can_delete_message_check(false, Some(UserRole::Admin))); // Admin can delete anything
    assert!(!can_delete_message_check(false, Some(UserRole::Member))); // Member cannot delete others'
    assert!(!can_delete_message_check(false, None)); // No role cannot delete
}
