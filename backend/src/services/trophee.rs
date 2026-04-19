use chrono::{DateTime, Utc};
use serde::Serialize;
use socketioxide::SocketIo;
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Serialize, Clone)]
pub struct Trophee {
    pub id: String,
    pub title: Option<String>,
    pub condition: Option<String>,
    pub description_fun: Option<String>,
    pub status: String,
    pub progress: Option<i32>,
    pub current: Option<i64>,
    pub goal: Option<i64>,
    pub unlocked_at: Option<DateTime<Utc>>,
    pub trophee_type: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TropheeUnlockedPayload {
    pub id: String,
    pub title: String,
    pub toast: String,
    pub trophee_type: String,
    pub unlocked_at: DateTime<Utc>,
}

#[derive(Debug)]
pub struct SyncResult {
    pub trophees: Vec<Trophee>,
    pub newly_unlocked: Vec<TropheeUnlockedPayload>,
}

#[derive(Debug, Clone, Copy)]
struct Definition {
    id: &'static str,
    title: &'static str,
    condition: &'static str,
    description_fun: &'static str,
    goal: i64,
    trophee_type: &'static str,
    secret: bool,
}

#[derive(Debug)]
struct UserStats {
    messages_count: i64,
    reactions_count: i64,
    owned_servers_count: i64,
    joined_servers_count: i64,
    has_avatar: bool,
}

const DEFINITIONS: [Definition; 7] = [
    Definition {
        id: "welcome_aboard",
        title: "Bienvenue a bord",
        condition: "Creer un compte",
        description_fun: "Le voyage commence maintenant.",
        goal: 1,
        trophee_type: "profil",
        secret: false,
    },
    Definition {
        id: "first_message",
        title: "Premier message",
        condition: "Envoyer 1 message",
        description_fun: "Une petite phrase, un grand pas.",
        goal: 1,
        trophee_type: "social",
        secret: false,
    },
    Definition {
        id: "talkative",
        title: "Bavard",
        condition: "Envoyer 10 messages",
        description_fun: "Tu commences a te faire entendre.",
        goal: 10,
        trophee_type: "social",
        secret: false,
    },
    Definition {
        id: "community_builder",
        title: "Createur de communaute",
        condition: "Posseder 1 serveur",
        description_fun: "Ton royaume prend forme.",
        goal: 1,
        trophee_type: "social",
        secret: false,
    },
    Definition {
        id: "reaction_fan",
        title: "Reaction master",
        condition: "Ajouter 5 reactions",
        description_fun: "Tu parles aussi en emojis.",
        goal: 5,
        trophee_type: "social",
        secret: false,
    },
    Definition {
        id: "social_circle",
        title: "Cercle social",
        condition: "Rejoindre 3 serveurs",
        description_fun: "Toujours plus de monde a rencontrer.",
        goal: 3,
        trophee_type: "social",
        secret: false,
    },
    Definition {
        id: "mystery_ghost",
        title: "Fantome legendaire",
        condition: "Envoyer 50 messages",
        description_fun: "Le serveur murmure ton nom.",
        goal: 50,
        trophee_type: "social",
        secret: true,
    },
];

pub async fn ensure_schema(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS user_trophies (
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            trophy_id VARCHAR(100) NOT NULL,
            unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, trophy_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn sync_user_trophees(pool: &PgPool, user_id: Uuid) -> Result<SyncResult, sqlx::Error> {
    ensure_schema(pool).await?;

    let stats = get_user_stats(pool, user_id).await?;

    let rows = sqlx::query(
        r#"
        SELECT trophy_id, unlocked_at
        FROM user_trophies
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let mut unlocked_map: HashMap<String, DateTime<Utc>> = HashMap::new();
    for row in rows {
        let trophy_id: String = row.get("trophy_id");
        let unlocked_at: DateTime<Utc> = row.get("unlocked_at");
        unlocked_map.insert(trophy_id, unlocked_at);
    }

    let mut newly_unlocked = Vec::new();
    let mut trophees = Vec::with_capacity(DEFINITIONS.len());

    for definition in DEFINITIONS {
        let current = metric_for(definition.id, &stats);
        let should_be_unlocked = current >= definition.goal;

        if should_be_unlocked && !unlocked_map.contains_key(definition.id) {
            let inserted_unlocked_at = sqlx::query_scalar::<_, DateTime<Utc>>(
                r#"
                INSERT INTO user_trophies (user_id, trophy_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, trophy_id) DO NOTHING
                RETURNING unlocked_at
                "#,
            )
            .bind(user_id)
            .bind(definition.id)
            .fetch_optional(pool)
            .await?;

            if let Some(unlocked_at) = inserted_unlocked_at {
                unlocked_map.insert(definition.id.to_string(), unlocked_at);
                newly_unlocked.push(TropheeUnlockedPayload {
                    id: definition.id.to_string(),
                    title: definition.title.to_string(),
                    toast: definition.description_fun.to_string(),
                    trophee_type: definition.trophee_type.to_string(),
                    unlocked_at,
                });
            }
        }

        let unlocked_at = unlocked_map.get(definition.id).cloned();
        let is_unlocked = unlocked_at.is_some();

        let status = if is_unlocked {
            "unlocked".to_string()
        } else if definition.secret {
            "secret".to_string()
        } else {
            "in_progress".to_string()
        };

        let progress = if is_unlocked {
            Some(100)
        } else {
            Some(((current as f64 / definition.goal as f64) * 100.0).clamp(0.0, 100.0) as i32)
        };

        let title = if definition.secret && !is_unlocked {
            None
        } else {
            Some(definition.title.to_string())
        };

        let condition = if definition.secret && !is_unlocked {
            None
        } else {
            Some(definition.condition.to_string())
        };

        let description_fun = if definition.secret && !is_unlocked {
            None
        } else {
            Some(definition.description_fun.to_string())
        };

        trophees.push(Trophee {
            id: definition.id.to_string(),
            title,
            condition,
            description_fun,
            status,
            progress,
            current: Some(current),
            goal: Some(definition.goal),
            unlocked_at,
            trophee_type: definition.trophee_type.to_string(),
        });
    }

    Ok(SyncResult {
        trophees,
        newly_unlocked,
    })
}

pub async fn notify_unlocked(io: &SocketIo, user_id: Uuid, trophies: &[TropheeUnlockedPayload]) {
    if trophies.is_empty() {
        return;
    }

    let room = format!("user:{}", user_id);

    for trophy in trophies {
        let _ = io.to(room.clone()).emit("trophee_unlocked", trophy).await;
    }

    let payload = serde_json::json!({ "userId": user_id.to_string() });
    let _ = io.to(room).emit("trophees_updated", &payload).await;
}

async fn get_user_stats(pool: &PgPool, user_id: Uuid) -> Result<UserStats, sqlx::Error> {
    let messages_count = query_count_or_zero(
        pool,
        "SELECT COUNT(*)::BIGINT FROM messages m JOIN users u ON m.author = u.username WHERE u.id = $1",
        user_id,
    )
    .await?;

    let reactions_count =
        query_count_or_zero(pool, "SELECT COUNT(*)::BIGINT FROM message_reactions WHERE user_id = $1", user_id)
            .await?;

    let owned_servers_count =
        query_count_or_zero(pool, "SELECT COUNT(*)::BIGINT FROM servers WHERE owner_id = $1", user_id)
            .await?;

    let joined_servers_count =
        query_count_or_zero(pool, "SELECT COUNT(*)::BIGINT FROM server_members WHERE user_id = $1", user_id)
            .await?;

    let has_avatar = query_bool_or_false(
        pool,
        "SELECT COALESCE(avatar_url IS NOT NULL AND avatar_url <> '', FALSE) FROM users WHERE id = $1",
        user_id,
    )
    .await?;

    Ok(UserStats {
        messages_count,
        reactions_count,
        owned_servers_count,
        joined_servers_count,
        has_avatar,
    })
}

async fn query_count_or_zero(pool: &PgPool, query: &str, user_id: Uuid) -> Result<i64, sqlx::Error> {
    match sqlx::query_scalar::<_, i64>(query)
        .bind(user_id)
        .fetch_one(pool)
        .await
    {
        Ok(value) => Ok(value),
        Err(sqlx::Error::Database(db_err)) if db_err.code().as_deref() == Some("42P01") => Ok(0),
        Err(e) => Err(e),
    }
}

async fn query_bool_or_false(pool: &PgPool, query: &str, user_id: Uuid) -> Result<bool, sqlx::Error> {
    match sqlx::query_scalar::<_, bool>(query)
        .bind(user_id)
        .fetch_one(pool)
        .await
    {
        Ok(value) => Ok(value),
        Err(sqlx::Error::Database(db_err)) if db_err.code().as_deref() == Some("42P01") => Ok(false),
        Err(e) => Err(e),
    }
}

fn metric_for(id: &str, stats: &UserStats) -> i64 {
    match id {
        "welcome_aboard" => 1,
        "first_message" => stats.messages_count,
        "talkative" => stats.messages_count,
        "community_builder" => stats.owned_servers_count,
        "reaction_fan" => stats.reactions_count,
        "social_circle" => stats.joined_servers_count,
        "mystery_ghost" => stats.messages_count,
        "profile_customizer" => i64::from(stats.has_avatar),
        _ => 0,
    }
}
