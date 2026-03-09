use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::services::permission::UserRole;
use crate::models::user::UserStatus;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Server {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub invite_code: String,
    pub is_public: bool,
    pub owner_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// create a server
#[derive(Debug, Deserialize)]
pub struct CreateServer {
    pub name: String,
    pub description: Option<String>,
    pub is_public: Option<bool>,
}

impl CreateServer {
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Server name cannot be empty".to_string());
        }
        if self.name.len() > 50 {
            return Err("Server name must be 50 characters or less".to_string());
        }
        Ok(())
    }
}

// update a server
#[derive(Debug, Deserialize)]
pub struct UpdateServer {
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub is_public: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ServerMember {
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub role: UserRole,
    pub status: UserStatus,
    pub joined_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_server_dto() {
        let dto = CreateServer {
            name: "My Server".to_string(),
            description: Some("A cool place".to_string()),
            is_public: Some(true),
        };

        assert_eq!(dto.name, "My Server");
        assert_eq!(dto.description, Some("A cool place".to_string()));
        assert_eq!(dto.is_public, Some(true));
    }

    #[test]
    fn test_server_struct_instantiation() {
        let id = Uuid::new_v4();
        let owner_id = Uuid::new_v4();
        let now = Utc::now();

        let server = Server {
            id,
            name: "Test Server".to_string(),
            description: None,
            icon_url: None,
            invite_code: "ABCDEF".to_string(),
            is_public: false,
            owner_id,
            created_at: now,
            updated_at: now,
        };

        assert_eq!(server.id, id);
        assert_eq!(server.invite_code, "ABCDEF");
        assert!(!server.is_public);
    }

    #[test]
    fn test_create_server_validation() {
        let valid = CreateServer {
            name: "Valid Name".to_string(),
            description: None,
            is_public: None,
        };
        assert!(valid.validate().is_ok());

        let empty = CreateServer {
            name: "   ".to_string(),
            description: None,
            is_public: None,
        };
        assert!(empty.validate().is_err());

        let too_long = CreateServer {
            name: "a".repeat(51),
            description: None,
            is_public: None,
        };
        assert!(too_long.validate().is_err());
    }
}
