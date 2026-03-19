use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChatMessage {
    pub id: i32,
    #[sqlx(rename = "channel_id")]
    #[serde(rename = "channelId")]
    pub channel_id: String,
    pub author: String,
    #[sqlx(rename = "author_id")]
    #[serde(rename = "authorId")]
    pub author_id: Option<uuid::Uuid>,
    pub content: String,
    #[sqlx(rename = "created_at")]
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json;

    #[test]
    fn test_chat_message_serialization() {
        let msg = ChatMessage {
            id: 1,
            channel_id: "123".to_string(),
            author: "User".to_string(),
            author_id: Some(uuid::Uuid::new_v4()),
            content: "Hello".to_string(),
            created_at: 1600000000,
        };

        let json = serde_json::to_string(&msg).unwrap();
        
        // Verify camelCase serialization
        assert!(json.contains("\"channelId\":\"123\""));
        assert!(json.contains("\"createdAt\":1600000000"));
    }
}
