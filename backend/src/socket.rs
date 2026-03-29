use socketioxide::{
    extract::{SocketRef, Data, State},
};
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use crate::models::message::ChatMessage;
use crate::models::channel::Channel;
use uuid::Uuid;
use sqlx::{PgPool, Row};
use redis::AsyncCommands;
use dashmap::DashMap;
use crate::VoiceState;
use crate::services::message::{AddReactionSchema, add_reaction};


#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypingPayload {
    pub channel_id: String,
    pub author: String,
    pub user_id: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StopTypingPayload {
    pub channel_id: String,
    pub author: String,
    pub user_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessagePayload {
    pub channel_id: String,
    pub author: String,
    #[serde(rename = "authorId")]
    pub author_id: Option<Uuid>,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelCreatedPayload {
    pub channel: Channel,
    pub server_id: Uuid,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelDeletedPayload {
    pub channel_id: Uuid,
    pub server_id: Uuid,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerMemberRemovedPayload {
    pub server_id: Uuid,
    pub user_id: Uuid,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinVoicePayload {
    pub channel_id: String,
    pub user_id: String,
    pub server_id: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaveVoicePayload {
    pub channel_id: String,
    pub user_id: String,
    pub server_id: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MutePayload {
    pub channel_id: String,
    pub user_id: String,
    pub server_id: String,
    pub muted: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignalPayload {
    pub target_user_id: String,
    pub signal: serde_json::Value,
    pub sender_id: String,
}


#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReactionPayload {
    pub message_id: i32,
    pub user_id: String,
    pub emoji: String,
}


pub async fn on_connect(socket: SocketRef) {
    println!("Socket connected: {}", socket.id);

    socket.on("join", |socket: SocketRef, Data::<String>(room), State::<Arc<DashMap<String, VoiceState>>>(voice_users)| async move {
        println!("Socket {} attempting to join room '{}'", socket.id, room);
        socket.join(room.clone());
        println!("✅ Socket {} successfully joined room '{}'", socket.id, room);

        if room.starts_with("server:") {
            let server_id = room.trim_start_matches("server:");
            let states: Vec<VoiceState> = voice_users
                .iter()
                .filter(|r| r.value().server_id == server_id)
                .map(|r| r.value().clone())
                .collect();
            
            if !states.is_empty() {
                 let _ = socket.emit("voice_states", &states);
            }
        }
    });

    socket.on("join_voice", |socket: SocketRef, Data::<JoinVoicePayload>(data), State::<Arc<DashMap<String, VoiceState>>>(voice_users), State::<PgPool>(pool)| async move {
        let room = format!("voice:{}", data.channel_id);
        println!("User {} joining voice channel {}", data.user_id, data.channel_id);
        socket.join(room.clone());

        let user_data = sqlx::query("SELECT username, avatar_url FROM users WHERE id = $1")
            .bind(uuid::Uuid::parse_str(&data.user_id).unwrap_or_default())
            .fetch_optional(&pool)
            .await
            .unwrap_or(None);
        
        let (username, avatar_url) = if let Some(row) = user_data {
            (
                row.try_get("username").unwrap_or_else(|_| "Unknown".to_string()),
                row.try_get("avatar_url").ok()
            )
        } else {
            ("Unknown".to_string(), None)
        };
        
        let state_voice = VoiceState {
            user_id: data.user_id.clone(),
            username,
            avatar_url,
            channel_id: data.channel_id.clone(),
            server_id: data.server_id.clone(),
            muted: false,
            deafened: false,
            socket_id: Some(socket.id.to_string()),
        };
        voice_users.insert(data.user_id.clone(), state_voice.clone());

        let server_room = format!("server:{}", data.server_id);
        let _ = socket.to(server_room).emit("voice_state_update", &state_voice).await;
        let _ = socket.emit("voice_state_update", &state_voice);
        let _ = socket.to(room).emit("user_joined_voice", &data.user_id).await;
    });

    socket.on("leave_voice", |socket: SocketRef, Data::<LeaveVoicePayload>(data), State::<Arc<DashMap<String, VoiceState>>>(voice_users)| async move {
        let room = format!("voice:{}", data.channel_id);
        println!("User {} leaving voice channel {}", data.user_id, data.channel_id);
        let _ = socket.leave(room.clone());
        voice_users.remove(&data.user_id);

        let server_room = format!("server:{}", data.server_id);
        let _ = socket.to(server_room).emit("voice_user_left", &data).await;
        let _ = socket.emit("voice_user_left", &data);
        let _ = socket.to(room).emit("user_left_voice", &data.user_id).await;
    });

    socket.on("voice_mute", |socket: SocketRef, Data::<MutePayload>(data), State::<Arc<DashMap<String, VoiceState>>>(voice_users)| async move {
        if let Some(mut state_voice) = voice_users.get_mut(&data.user_id) {
            state_voice.muted = data.muted;
            let updated_state = state_voice.clone();
            let server_room = format!("server:{}", data.server_id);
            let _ = socket.to(server_room).emit("voice_state_update", &updated_state).await;
            let _ = socket.emit("voice_state_update", &updated_state);
        }
    });

    socket.on("offer", |socket: SocketRef, Data::<SignalPayload>(data)| async move {
        let target_room = format!("user:{}", data.target_user_id);
        let _ = socket.to(target_room).emit("offer", &data).await;
    });

    socket.on("answer", |socket: SocketRef, Data::<SignalPayload>(data)| async move {
        let target_room = format!("user:{}", data.target_user_id);
        let _ = socket.to(target_room).emit("answer", &data).await;
    });

    socket.on("ice_candidate", |socket: SocketRef, Data::<SignalPayload>(data)| async move {
        let target_room = format!("user:{}", data.target_user_id);
        let _ = socket.to(target_room).emit("ice_candidate", &data).await;
    });

    socket.on("leave", |socket: SocketRef, Data::<String>(room)| async move {
        let _ = socket.leave(room);
    });

    socket.on("typing", |socket: SocketRef, Data::<TypingPayload>(data)| async move {
        let _ = socket.to(data.channel_id.clone()).emit("typing", &data).await;
    });

    socket.on("stop_typing", |socket: SocketRef, Data::<StopTypingPayload>(data)| async move {
        let _ = socket.to(data.channel_id.clone()).emit("stop_typing", &data).await;
    });

    socket.on("send_message", |socket: SocketRef, Data::<SendMessagePayload>(data), State::<PgPool>(pool), State::<redis::Client>(redis_client)| async move {
        let created_at = chrono::Utc::now().timestamp_millis();
        let result = sqlx::query_as::<_, ChatMessage>(
            "INSERT INTO messages (channel_id, author, author_id, content, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, channel_id, author, author_id, content, created_at"
        )
        .bind(&data.channel_id)
        .bind(&data.author)
        .bind(&data.author_id)
        .bind(&data.content)
        .bind(created_at)
        .fetch_one(&pool)
        .await;

        if let Ok(msg) = result {
            if let Ok(mut conn) = redis_client.get_multiplexed_tokio_connection().await {
                let cache_key = format!("messages:{}", data.channel_id);
                let _: () = conn.del(cache_key).await.unwrap_or_default();
            }
            let _ = socket.emit("message", &msg);
            let _ = socket.to(data.channel_id.clone()).emit("message", &msg).await;
        }
    });

    socket.on(
        "add_reaction",
        |socket: SocketRef,
         Data::<ReactionPayload>(data),
         State::<PgPool>(pool)| async move {

            let user_id = match Uuid::parse_str(&data.user_id) {
                Ok(id) => id,
                Err(_) => return,
            };

            let schema = AddReactionSchema {
                message_id: data.message_id,
                user_id,
                emoji: data.emoji.clone(),
            };

            let channel_id = match add_reaction(&pool, schema).await {
                Ok(id) => id,
                Err(_) => return,
            };

            let _ = socket
                .to(channel_id)
                .emit("reaction_added", &data)
                .await;

            let _ = socket.emit("reaction_added", &data);
        },
    );

    socket.on(
        "remove_reaction",
        |socket: SocketRef,
         Data::<ReactionPayload>(data),
         State::<PgPool>(pool)| async move {

            let user_id = match Uuid::parse_str(&data.user_id) {
                Ok(id) => id,
                Err(_) => return,
            };

            let _ = sqlx::query(
                "DELETE FROM message_reactions
             WHERE message_id = $1 AND user_id = $2 AND emoji = $3"
            )
                .bind(data.message_id)
                .bind(user_id)
                .bind(&data.emoji)
                .execute(&pool)
                .await;

            let channel_id: Result<String, _> = sqlx::query_scalar(
                "SELECT channel_id FROM messages WHERE id = $1"
            )
                .bind(data.message_id)
                .fetch_one(&pool)
                .await;

            if let Ok(channel_id) = channel_id {
                let _ = socket
                    .to(channel_id.clone())
                    .emit("reaction_removed", &data)
                    .await;

                let _ = socket.emit("reaction_removed", &data);
            }
        },
    );

    socket.on("disconnect", |socket: SocketRef, State::<Arc<DashMap<String, VoiceState>>>(voice_users)| async move {
        let socket_id = socket.id.to_string();
        let mut user_to_remove = None;
        for entry in voice_users.iter() {
            if entry.value().socket_id.as_ref() == Some(&socket_id) {
                user_to_remove = Some(entry.value().clone());
                break;
            }
        }
        if let Some(sv) = user_to_remove {
            voice_users.remove(&sv.user_id);
            let payload = LeaveVoicePayload {
                channel_id: sv.channel_id.clone(),
                user_id: sv.user_id.clone(),
                server_id: sv.server_id.clone(),
            };
            let _ = socket.to(format!("server:{}", sv.server_id)).emit("voice_user_left", &payload).await;
            let _ = socket.to(format!("voice:{}", sv.channel_id)).emit("user_left_voice", &sv.user_id).await;
        }
    });
}

pub async fn broadcast_channel_created(io: &socketioxide::SocketIo, server_id: Uuid, channel: Channel) {
    let payload = ChannelCreatedPayload { channel, server_id };
    let _ = io.to(format!("server:{}", server_id)).emit("channel_created", &payload).await;
}

pub async fn broadcast_channel_deleted(io: &socketioxide::SocketIo, server_id: Uuid, channel_id: Uuid) {
    let payload = ChannelDeletedPayload { channel_id, server_id };
    let _ = io.to(format!("server:{}", server_id)).emit("channel_deleted", &payload).await;
}

pub async fn notify_member_removed(io: &socketioxide::SocketIo, server_id: Uuid, user_id: Uuid) {
    let payload = ServerMemberRemovedPayload { server_id, user_id };
    let _ = io.to(format!("user:{}", user_id)).emit("server_member_removed", &payload).await;
}

pub async fn broadcast_message_deleted(io: &socketioxide::SocketIo, channel_id: String, message_id: i64) {
    #[derive(Serialize)]
    struct MDP {
        #[serde(rename = "channelId")]
        channel_id: String,
        #[serde(rename = "messageId")]
        message_id: i64,
    }
    let payload = MDP { channel_id: channel_id.clone(), message_id };
    let _ = io.to(channel_id).emit("message_deleted", &payload).await;
}

pub async fn broadcast_message_updated(io: &socketioxide::SocketIo, message: ChatMessage) {
    let _ = io.to(message.channel_id.clone()).emit("message_updated", &message).await;
}

pub async fn broadcast_user_status_changed(io: &socketioxide::SocketIo, server_id: Uuid, user_id: Uuid, status: crate::models::user::UserStatus) {
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct USCP { user_id: String, status: crate::models::user::UserStatus, server_id: String }
    let payload = USCP { user_id: user_id.to_string(), status, server_id: server_id.to_string() };
    let _ = io.to(format!("server:{}", server_id)).emit("user_status_changed", &payload).await;
}

pub async fn broadcast_user_updated(io: &socketioxide::SocketIo, server_id: Uuid, user: crate::models::user::PublicUser) {
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct UUP { user: crate::models::user::PublicUser, server_id: String }
    let payload = UUP { user, server_id: server_id.to_string() };
    let _ = io.to(format!("server:{}", server_id)).emit("user_updated", &payload).await;
}
