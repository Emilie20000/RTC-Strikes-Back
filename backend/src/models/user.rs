use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub avatar_url: Option<String>,
    pub status: UserStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "user_status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserStatus {
    Online,
    Away,
    Busy,
    Offline,
}

// DTO for creating a new user (signup)
#[derive(Debug, Deserialize)]
pub struct CreateUser {
    pub username: String,
    pub email: String,
    pub password: String,
}

impl CreateUser {
    pub fn validate(&self) -> Result<(), String> {
        if self.username.len() < 3 {
            return Err("Username must be at least 3 characters long".to_string());
        }
        if !self.email.contains('@') {
            return Err("Invalid email format".to_string());
        }
        if self.password.len() < 6 {
            return Err("Password must be at least 6 characters long".to_string());
        }
        Ok(())
    }
}

// DTO for user login
#[derive(Debug, Deserialize)]
pub struct LoginUser {
    pub email: String,
    pub password: String,
}

// DTO for public user info (no password)
#[derive(Debug, Serialize, Clone)]
pub struct PublicUser {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub status: UserStatus,
    pub created_at: DateTime<Utc>,
}

impl From<User> for PublicUser {
    fn from(user: User) -> Self {
        PublicUser {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar_url: user.avatar_url,
            status: user.status,
            created_at: user.created_at,
        }
    }
}

// Payload pour l'update de la pfp d'un user
#[derive(Debug, Deserialize)]
pub struct UpdateUserPayload {
    pub username: Option<String>,
    pub avatar_url: Option<String>,
}
  
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_to_public_user_conversion() {
        let user_id = Uuid::new_v4();
        let now = Utc::now();
        
        let user = User {
            id: user_id,
            username: "testuser".to_string(),
            email: "test@example.com".to_string(),
            password_hash: "hashed_secret".to_string(),
            avatar_url: Some("http://avatar.url".to_string()),
            status: UserStatus::Online,
            created_at: now,
            updated_at: now,
        };

        let public_user: PublicUser = PublicUser::from(user.clone());

        assert_eq!(public_user.id, user.id);
        assert_eq!(public_user.username, user.username);
        assert_eq!(public_user.email, user.email);
        assert_eq!(public_user.avatar_url, user.avatar_url);
        assert_eq!(public_user.status, user.status);
        assert_eq!(public_user.created_at, user.created_at);
    }

    #[test]
    fn test_create_user_validation() {
        let valid_user = CreateUser {
            username: "valid".to_string(),
            email: "valid@example.com".to_string(),
            password: "validpassword".to_string(),
        };
        assert!(valid_user.validate().is_ok());

        let short_username = CreateUser {
            username: "no".to_string(),
            email: "valid@example.com".to_string(),
            password: "validpassword".to_string(),
        };
        assert!(short_username.validate().is_err());

        let invalid_email = CreateUser {
            username: "valid".to_string(),
            email: "notanemail".to_string(),
            password: "validpassword".to_string(),
        };
        assert!(invalid_email.validate().is_err());

        let short_password = CreateUser {
            username: "valid".to_string(),
            email: "valid@example.com".to_string(),
            password: "123".to_string(),
        };
        assert!(short_password.validate().is_err());
    }
}
