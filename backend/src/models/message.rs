use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum MentionKind {
    User,
    Role,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageMention {
    pub kind: MentionKind,
    pub value: String,
    pub user_id: Option<Uuid>,
    pub role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChatMessage {
    pub id: i32,
    #[sqlx(rename = "channel_id")]
    #[serde(rename = "channelId")]
    pub channel_id: String,
    pub author: String,
    pub content: String,
    #[sqlx(rename = "created_at")]
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(default)]
    #[sqlx(skip)]
    pub mentions: Vec<MessageMention>,
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
            content: "Hello".to_string(),
            created_at: 1600000000,
            mentions: Vec::new(),
        };

        let json = serde_json::to_string(&msg).unwrap();
        
        // Verify camelCase serialization
        assert!(json.contains("\"channelId\":\"123\""));
        assert!(json.contains("\"createdAt\":1600000000"));
    }
}
