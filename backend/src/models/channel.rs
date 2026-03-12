use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Channel {
    pub id: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
    pub kind: ChannelType,
    #[serde(rename = "serverId")]
    pub server_id: Option<Uuid>,
    #[serde(rename = "recipientId")]
    #[sqlx(default)]
    pub recipient_id: Option<Uuid>,
    #[serde(rename = "avatarUrl")]
    #[sqlx(default)]
    pub avatar_url: Option<String>,
    #[sqlx(rename = "created_at")]
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[sqlx(rename = "updated_at")]
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "channel_type", rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ChannelType {
    Text,
    Dm,
    Voice,
}

// DTO for creating a channel
#[derive(Debug, Clone, Deserialize)]
pub struct CreateChannel {
    pub name: String,
    pub description: Option<String>,
    pub server_id: Uuid,
    pub kind: Option<ChannelType>,
}

// DTO for updating a channel
#[derive(Debug, Deserialize)]
pub struct UpdateChannel {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json;

    #[test]
    fn test_channel_type_serialization() {
        let text_type = ChannelType::Text;
        let serialized = serde_json::to_string(&text_type).unwrap();
        assert_eq!(serialized, "\"TEXT\"");

        let voice_type = ChannelType::Voice;
        let serialized = serde_json::to_string(&voice_type).unwrap();
        assert_eq!(serialized, "\"VOICE\"");
    }

    #[test]
    fn test_channel_type_deserialization() {
        let json = "\"TEXT\"";
        let deserialized: ChannelType = serde_json::from_str(json).unwrap();
        assert_eq!(deserialized, ChannelType::Text);

        let json = "\"VOICE\"";
        let deserialized: ChannelType = serde_json::from_str(json).unwrap();
        assert_eq!(deserialized, ChannelType::Voice);
    }
}
