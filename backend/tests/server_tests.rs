use sqlx::PgPool;
use uuid::Uuid;
use backend::services::server::*;
use backend::models::server::{CreateServer, UpdateServer};

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
async fn test_server_management() {
    let pool = get_test_pool().await;
    let owner_id = create_test_user(&pool).await;

    // 1. Create Server
    let payload = CreateServer {
        name: "Management Server".to_string(),
        description: None,
        is_public: None,
    };
    let server = create_server(&pool, owner_id, payload).await.expect("Failed to create server");
    assert_eq!(server.name, "Management Server");

    // 2. Get User Servers
    let servers = get_user_servers(&pool, owner_id).await.expect("Failed to get user servers");
    assert!(servers.iter().any(|s| s.id == server.id));

    // 3. Get Server by ID
    let found = get_server_by_id(&pool, server.id, owner_id).await.expect("Failed to get server by id");
    assert!(found.is_some());

    // 4. Update Server
    let update_payload = UpdateServer {
        name: Some("New Name".to_string()),
        description: None,
        icon_url: None,
        is_public: None,
    };
    let updated = update_server(&pool, server.id, owner_id, update_payload).await.expect("Failed to update server");
    assert_eq!(updated.name, "New Name");

    // 5. Delete Server
    delete_server(&pool, server.id, owner_id).await.expect("Failed to delete server");
    let after_delete = get_server_by_id(&pool, server.id, owner_id).await.expect("Check after delete");
    assert!(after_delete.is_none());
}

#[tokio::test]
async fn test_server_membership() {
    let pool = get_test_pool().await;
    let owner_id = create_test_user(&pool).await;
    let member_id = create_test_user(&pool).await;

    let server = create_server(&pool, owner_id, CreateServer { name: "Member Server".to_string(), description: None, is_public: None }).await.unwrap();

    // 1. Join Server
    join_server(&pool, member_id, server.invite_code).await.expect("Failed to join server");

    // 2. Get Members
    let members = get_server_members(&pool, server.id).await.expect("Failed to get members");
    assert!(members.iter().any(|m| m.user_id == member_id));

    // 3. Check if member
    assert!(backend::services::permission::is_server_member(&pool, member_id, server.id).await.unwrap());

    // 4. Remove member (Correct order: pool, server_id, requester_id, target_id)
    remove_member(&pool, server.id, owner_id, member_id).await.expect("Failed to remove member");
    assert!(!backend::services::permission::is_server_member(&pool, member_id, server.id).await.unwrap());
}

#[tokio::test]
async fn test_server_bans() {
    let pool = get_test_pool().await;
    let owner_id = create_test_user(&pool).await;
    let target_id = create_test_user(&pool).await;

    let server = create_server(&pool, owner_id, CreateServer { name: "Ban Server".to_string(), description: None, is_public: None }).await.unwrap();

    // 1. Ban user
    ban_user(&pool, server.id, owner_id, target_id, Some("Bad behavior".to_string()), Some(24)).await.expect("Failed to ban user");

    // 2. Check if banned (is_server_member should return false as user was removed)
    assert!(!backend::services::permission::is_server_member(&pool, target_id, server.id).await.unwrap());

    // 3. Get bans
    let bans = get_server_bans(&pool, server.id, owner_id).await.expect("Failed to get bans");
    assert!(bans.iter().any(|b| b.user_id == target_id && b.reason == Some("Bad behavior".to_string())));

    // 4. Unban user
    unban_user(&pool, server.id, owner_id, target_id).await.expect("Failed to unban user");
    let bans_after = get_server_bans(&pool, server.id, owner_id).await.expect("Check bans after unban");
    assert!(!bans_after.iter().any(|b| b.user_id == target_id));
}

#[tokio::test]
async fn test_server_roles_and_transfer() {
    let pool = get_test_pool().await;
    let owner_id = create_test_user(&pool).await;
    let member_id = create_test_user(&pool).await;

    let server = create_server(&pool, owner_id, CreateServer { name: "Role Server".to_string(), description: None, is_public: None }).await.unwrap();
    join_server(&pool, member_id, server.invite_code.clone()).await.unwrap();

    // 1. Update role to Admin
    update_member_role(&pool, server.id, owner_id, member_id, backend::services::permission::UserRole::Admin).await.expect("Failed to promote to admin");
    let role = backend::services::permission::get_user_role(&pool, member_id, server.id).await.unwrap();
    assert_eq!(role, Some(backend::services::permission::UserRole::Admin));

    // 2. Transfer Ownership
    update_member_role(&pool, server.id, owner_id, member_id, backend::services::permission::UserRole::Owner).await.expect("Failed to transfer ownership");
    
    let new_owner_role = backend::services::permission::get_user_role(&pool, member_id, server.id).await.unwrap();
    assert_eq!(new_owner_role, Some(backend::services::permission::UserRole::Owner));
    
    let old_owner_role = backend::services::permission::get_user_role(&pool, owner_id, server.id).await.unwrap();
    assert_eq!(old_owner_role, Some(backend::services::permission::UserRole::Member));
}

#[tokio::test]
async fn test_system_messages() {
    let pool = get_test_pool().await;
    let owner_id = create_test_user(&pool).await;
    let server = create_server(&pool, owner_id, CreateServer { name: "System Msg Server".to_string(), description: None, is_public: None }).await.unwrap();
    
    // Get the arrivals channel ID (it's created automatically)
    let channels = sqlx::query!("SELECT id FROM channels WHERE server_id = $1 AND name = '📥-arrivées'", server.id)
        .fetch_all(&pool)
        .await
        .unwrap();
    let channel_id = channels[0].id;

    let msg = post_system_message(&pool, channel_id, "Welcome to the server!".to_string()).await.expect("Failed to post system message");
    assert_eq!(msg.author, "Système");
    assert_eq!(msg.content, "Welcome to the server!");
}

#[tokio::test]
async fn test_server_permission_errors() {
    let pool = get_test_pool().await;
    let owner_id = create_test_user(&pool).await;
    let other_id = create_test_user(&pool).await;

    let server = create_server(&pool, owner_id, CreateServer { name: "Error Server".to_string(), description: None, is_public: None }).await.unwrap();

    // 1. Non-owner cannot delete server
    let delete_res = delete_server(&pool, server.id, other_id).await;
    assert!(delete_res.is_err());

    // 2. Cannot ban owner
    join_server(&pool, other_id, server.invite_code.clone()).await.unwrap();
    update_member_role(&pool, server.id, owner_id, other_id, backend::services::permission::UserRole::Admin).await.unwrap();
    
    let ban_res = ban_user(&pool, server.id, other_id, owner_id, None, None).await;
    assert!(ban_res.is_err());

    // 3. Admin cannot promote to Owner
    let promote_res = update_member_role(&pool, server.id, other_id, other_id, backend::services::permission::UserRole::Owner).await;
    assert!(promote_res.is_err());
}
