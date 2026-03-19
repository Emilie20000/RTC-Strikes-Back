use std::collections::{HashMap, HashSet};

use serde::Serialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::{
    models::{
        channel::ChannelType,
        message::{ChatMessage, MentionKind},
    },
    services::permission::UserRole,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MentionNotificationPayload {
    pub kind: String,
    pub channel_id: String,
    pub server_id: Option<Uuid>,
    pub message_id: i32,
    pub from_username: String,
    pub from_user_id: Option<Uuid>,
    pub role: Option<String>,
}

#[derive(Debug, Clone)]
struct MentionReason {
    kind: MentionKind,
    role: Option<String>,
}

fn role_from_upper(value: &str) -> Option<UserRole> {
    match value {
        "OWNER" => Some(UserRole::Owner),
        "ADMIN" => Some(UserRole::Admin),
        "MEMBER" => Some(UserRole::Member),
        _ => None,
    }
}

async fn resolve_sender_id(pool: &PgPool, username: &str) -> Option<Uuid> {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM users WHERE username = $1")
        .bind(username)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

pub async fn emit_message_mentions(
    socket: &socketioxide::extract::SocketRef,
    pool: &PgPool,
    message: &ChatMessage,
) -> Result<(), sqlx::Error> {
    if message.mentions.is_empty() {
        return Ok(());
    }

    let channel_uuid = match Uuid::parse_str(&message.channel_id) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };

    let sender_id = resolve_sender_id(pool, &message.author).await;

    let channel_row = sqlx::query("SELECT kind, server_id FROM channels WHERE id = $1")
        .bind(channel_uuid)
        .fetch_optional(pool)
        .await?;

    let Some(channel_row) = channel_row else {
        return Ok(());
    };

    let kind: ChannelType = channel_row.try_get("kind")?;
    let server_id: Option<Uuid> = channel_row.try_get("server_id")?;

    let mut recipients: HashMap<Uuid, MentionReason> = HashMap::new();

    for mention in &message.mentions {
        if !matches!(mention.kind, MentionKind::User) {
            continue;
        }
        let Some(user_id) = mention.user_id else {
            continue;
        };
        if sender_id.is_some() && sender_id == Some(user_id) {
            continue;
        }

        recipients.entry(user_id).or_insert(MentionReason {
            kind: MentionKind::User,
            role: None,
        });
    }

    if kind != ChannelType::Dm {
        if let Some(server_id) = server_id {
            for mention in &message.mentions {
                if !matches!(mention.kind, MentionKind::Role) {
                    continue;
                }

                let Some(role_value) = mention.role.as_deref() else {
                    continue;
                };
                let Some(role) = role_from_upper(role_value) else {
                    continue;
                };

                let rows = sqlx::query_as::<_, (Uuid,)>(
                    "SELECT user_id FROM server_members WHERE server_id = $1 AND role = $2",
                )
                .bind(server_id)
                .bind(role)
                .fetch_all(pool)
                .await?;

                for (user_id,) in rows {
                    if sender_id.is_some() && sender_id == Some(user_id) {
                        continue;
                    }
                    recipients.entry(user_id).or_insert(MentionReason {
                        kind: MentionKind::Role,
                        role: Some(role_value.to_string()),
                    });
                }
            }
        }
    }

    let mut sent_to = HashSet::new();
    for (recipient_id, reason) in recipients {
        if !sent_to.insert(recipient_id) {
            continue;
        }

        let payload = MentionNotificationPayload {
            kind: match reason.kind {
                MentionKind::User => "USER".to_string(),
                MentionKind::Role => "ROLE".to_string(),
            },
            channel_id: message.channel_id.clone(),
            server_id,
            message_id: message.id,
            from_username: message.author.clone(),
            from_user_id: sender_id,
            role: reason.role,
        };

        let _ = socket
            .to(format!("user:{}", recipient_id))
            .emit("mention_notification", &payload)
            .await;
    }

    Ok(())
}