use sqlx::PgPool;
use uuid::Uuid;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type, Deserialize, Serialize)]
#[sqlx(type_name = "user_role", rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserRole {
    #[sqlx(rename = "OWNER")]
    Owner,
    #[sqlx(rename = "ADMIN")]
    Admin,
    #[sqlx(rename = "MEMBER")]
    Member,
}

/// Check if a user is a member of a server
pub async fn is_server_member(
    pool: &PgPool,
    user_id: Uuid,
    server_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("SELECT 1 FROM server_members WHERE user_id = $1 AND server_id = $2")
        .bind(user_id)
        .bind(server_id)
        .fetch_optional(pool)
        .await?;

    Ok(result.is_some())
}

/// Get the role of a user in a server
pub async fn get_user_role(
    pool: &PgPool,
    user_id: Uuid,
    server_id: Uuid,
) -> Result<Option<UserRole>, sqlx::Error> {
    let result: Option<UserRole> = sqlx::query_scalar(
        r#"
        SELECT role
        FROM server_members 
        WHERE user_id = $1 AND server_id = $2
        "#
    )
    .bind(user_id)
    .bind(server_id)
    .fetch_optional(pool)
    .await?;

    Ok(result)
}

/// Check if a user is an owner of a server
pub async fn is_owner(
    pool: &PgPool,
    user_id: Uuid,
    server_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let role = get_user_role(pool, user_id, server_id).await?;
    Ok(role == Some(UserRole::Owner))
}

/// Check if a user is an admin or owner of a server
pub async fn is_admin_or_owner(
    pool: &PgPool,
    user_id: Uuid,
    server_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let role = get_user_role(pool, user_id, server_id).await?;
    Ok(matches!(role, Some(UserRole::Admin) | Some(UserRole::Owner)))
}

/// Pure logic check for message deletion
pub fn can_delete_message_check(
    is_author: bool,
    user_role: Option<UserRole>,
) -> bool {
    if is_author {
        return true;
    }
    
    matches!(user_role, Some(UserRole::Admin) | Some(UserRole::Owner))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_role_serialization() {
        let role = UserRole::Owner;
        let serialized = serde_json::to_string(&role).unwrap();
        // Since we added #[serde(rename_all = "SCREAMING_SNAKE_CASE")], it should be "OWNER"
        assert_eq!(serialized, "\"OWNER\"");
    }

    #[test]
    fn test_user_role_deserialization() {
        let json = "\"OWNER\"";
        let role: UserRole = serde_json::from_str(json).unwrap();
        assert_eq!(role, UserRole::Owner);
        
        let json_member = "\"MEMBER\"";
        let role_member: UserRole = serde_json::from_str(json_member).unwrap();
        assert_eq!(role_member, UserRole::Member);
    }

    #[test]
    fn test_can_delete_message_check_edge_cases() {
        // Admin can delete messages they didn't write
        assert!(can_delete_message_check(false, Some(UserRole::Admin)));
        
        // Member cannot delete messages they didn't write
        assert!(!can_delete_message_check(false, Some(UserRole::Member)));
        
        // No role cannot delete messages they didn't write
        assert!(!can_delete_message_check(false, None));
    }
}
