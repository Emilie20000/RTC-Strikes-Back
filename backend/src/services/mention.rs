use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::{
    models::{channel::ChannelType, message::{ChatMessage, MessageMention, MentionKind}},
    services::permission::UserRole,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MentionableUser {
    pub id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MentionableRole {
    pub name: String,
    pub label: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MentionCandidates {
    pub users: Vec<MentionableUser>,
    pub roles: Vec<MentionableRole>,
}

#[derive(Debug, Clone)]
struct ParsedMentionToken {
    value: String,
}

const ROLE_ALIASES: [(&str, UserRole); 6] = [
    ("owner", UserRole::Owner),
    ("proprietaire", UserRole::Owner),
    ("propriétaire", UserRole::Owner),
    ("admin", UserRole::Admin),
    ("member", UserRole::Member),
    ("membre", UserRole::Member),
];

fn is_mention_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.'
}

fn parse_mention_tokens(content: &str) -> Vec<ParsedMentionToken> {
    let chars: Vec<char> = content.chars().collect();
    let mut out = Vec::new();
    let mut i = 0;

    while i < chars.len() {
        if chars[i] != '@' {
            i += 1;
            continue;
        }

        let mut j = i + 1;
        while j < chars.len() && is_mention_char(chars[j]) {
            j += 1;
        }

        if j > i + 1 {
            let token: String = chars[(i + 1)..j].iter().collect();
            out.push(ParsedMentionToken {
                value: token,
            });
            i = j;
            continue;
        }

        i += 1;
    }

    out
}

fn role_to_upper(role: UserRole) -> &'static str {
    match role {
        UserRole::Owner => "OWNER",
        UserRole::Admin => "ADMIN",
        UserRole::Member => "MEMBER",
    }
}

fn role_display(role: UserRole) -> &'static str {
    match role {
        UserRole::Owner => "owner",
        UserRole::Admin => "admin",
        UserRole::Member => "member",
    }
}

fn role_from_alias(alias: &str) -> Option<UserRole> {
    let lowered = alias.to_lowercase();
    ROLE_ALIASES
        .iter()
        .find(|(name, _)| *name == lowered)
        .map(|(_, role)| *role)
}

fn role_candidates_for_server() -> Vec<MentionableRole> {
    vec![
        MentionableRole {
            name: "owner".to_string(),
            label: "OWNER".to_string(),
        },
        MentionableRole {
            name: "admin".to_string(),
            label: "ADMIN".to_string(),
        },
        MentionableRole {
            name: "member".to_string(),
            label: "MEMBER".to_string(),
        },
    ]
}

pub async fn get_channel_meta(
    pool: &PgPool,
    channel_id: Uuid,
) -> Result<Option<(ChannelType, Option<Uuid>)>, sqlx::Error> {
    let row = sqlx::query("SELECT kind, server_id FROM channels WHERE id = $1")
        .bind(channel_id)
        .fetch_optional(pool)
        .await?;

    let Some(row) = row else {
        return Ok(None);
    };

    let kind: ChannelType = row.try_get("kind")?;
    let server_id: Option<Uuid> = row.try_get("server_id")?;
    Ok(Some((kind, server_id)))
}

pub async fn is_dm_subscriber(
    pool: &PgPool,
    channel_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(
        "SELECT 1 FROM channel_subscribers WHERE channel_id = $1 AND user_id = $2",
    )
    .bind(channel_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.is_some())
}

pub async fn get_channel_mention_candidates(
    pool: &PgPool,
    channel_id: Uuid,
) -> Result<MentionCandidates, sqlx::Error> {
    let Some((kind, server_id)) = get_channel_meta(pool, channel_id).await? else {
        return Ok(MentionCandidates {
            users: Vec::new(),
            roles: Vec::new(),
        });
    };

    let users = match (kind, server_id) {
        (ChannelType::Dm, _) => {
            let rows = sqlx::query(
                r#"
                SELECT u.id, u.username, u.avatar_url
                FROM users u
                JOIN channel_subscribers cs ON cs.user_id = u.id
                WHERE cs.channel_id = $1
                ORDER BY LOWER(u.username)
                "#,
            )
            .bind(channel_id)
            .fetch_all(pool)
            .await?;

            rows.into_iter()
                .filter_map(|row| {
                    Some(MentionableUser {
                        id: row.try_get("id").ok()?,
                        username: row.try_get("username").ok()?,
                        avatar_url: row.try_get::<Option<String>, _>("avatar_url").unwrap_or(None),
                    })
                })
                .collect()
        }
        (_, Some(sid)) => {
            let rows = sqlx::query(
                r#"
                SELECT u.id, u.username, u.avatar_url
                FROM users u
                JOIN server_members sm ON sm.user_id = u.id
                WHERE sm.server_id = $1
                ORDER BY LOWER(u.username)
                "#,
            )
            .bind(sid)
            .fetch_all(pool)
            .await?;

            rows.into_iter()
                .filter_map(|row| {
                    Some(MentionableUser {
                        id: row.try_get("id").ok()?,
                        username: row.try_get("username").ok()?,
                        avatar_url: row.try_get::<Option<String>, _>("avatar_url").unwrap_or(None),
                    })
                })
                .collect()
        }
        _ => Vec::new(),
    };

    let roles = if server_id.is_some() {
        role_candidates_for_server()
    } else {
        Vec::new()
    };

    Ok(MentionCandidates { users, roles })
}

pub async fn resolve_mentions_for_content(
    pool: &PgPool,
    channel_id: &str,
    content: &str,
) -> Result<Vec<MessageMention>, sqlx::Error> {
    let channel_uuid = match Uuid::parse_str(channel_id) {
        Ok(v) => v,
        Err(_) => return Ok(Vec::new()),
    };

    let candidates = get_channel_mention_candidates(pool, channel_uuid).await?;
    Ok(resolve_mentions_from_candidates(&candidates, content))
}

fn resolve_mentions_from_candidates(
    candidates: &MentionCandidates,
    content: &str,
) -> Vec<MessageMention> {
    let user_map = candidates
        .users
        .iter()
        .map(|u| (u.username.to_lowercase(), u))
        .collect::<std::collections::HashMap<_, _>>();
    let allow_roles = !candidates.roles.is_empty();

    let mut mentions = Vec::new();
    for token in parse_mention_tokens(content) {
        let lowered = token.value.to_lowercase();

        if let Some(user) = user_map.get(&lowered) {
            mentions.push(MessageMention {
                kind: MentionKind::User,
                value: user.username.clone(),
                user_id: Some(user.id),
                role: None,
            });
            continue;
        }

        if allow_roles {
            if let Some(role) = role_from_alias(&lowered) {
                mentions.push(MessageMention {
                    kind: MentionKind::Role,
                    value: role_display(role).to_string(),
                    user_id: None,
                    role: Some(role_to_upper(role).to_string()),
                });
            }
        }
    }

    mentions
}

pub async fn enrich_message_mentions(
    pool: &PgPool,
    mut message: ChatMessage,
) -> Result<ChatMessage, sqlx::Error> {
    message.mentions = resolve_mentions_for_content(pool, &message.channel_id, &message.content).await?;
    Ok(message)
}

pub async fn enrich_messages_mentions(
    pool: &PgPool,
    messages: Vec<ChatMessage>,
) -> Result<Vec<ChatMessage>, sqlx::Error> {
    if messages.is_empty() {
        return Ok(messages);
    }

    let channel_uuid = match Uuid::parse_str(&messages[0].channel_id) {
        Ok(v) => v,
        Err(_) => return Ok(messages),
    };

    let candidates = get_channel_mention_candidates(pool, channel_uuid).await?;
    let mut out = Vec::with_capacity(messages.len());
    for mut message in messages {
        message.mentions = resolve_mentions_from_candidates(&candidates, &message.content);
        out.push(message);
    }
    Ok(out)
}
