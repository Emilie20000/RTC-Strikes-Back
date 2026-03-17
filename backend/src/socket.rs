use socketioxide::{
    extract::{SocketRef, Data, State},
};
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use crate::models::message::ChatMessage;
use crate::models::channel::Channel;
use uuid::Uuid;
use sqlx::{PgPool, Row};

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

use dashmap::DashMap;
use crate::VoiceState;

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

pub async fn on_connect(socket: SocketRef) {
    println!("Socket connected: {}", socket.id);

    socket.on("join", |socket: SocketRef, Data::<String>(room), State::<Arc<DashMap<String, VoiceState>>>(voice_users)| async move {
        println!("Socket {} attempting to join room '{}'", socket.id, room);
        socket.join(room.clone());
        println!("✅ Socket {} successfully joined room '{}'", socket.id, room);

        // If joining a server room, send current voice states for that server
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

        // Fetch user info
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
        
        // Update state
        let state = VoiceState {
            user_id: data.user_id.clone(),
            username,
            avatar_url,
            channel_id: data.channel_id.clone(),
            server_id: data.server_id.clone(),
            muted: false, // Default unmuted
            deafened: false,
            socket_id: Some(socket.id.to_string()),
        };
        voice_users.insert(data.user_id.clone(), state.clone());

        // Notify server room (for sidebar update)
        let server_room = format!("server:{}", data.server_id);
        if let Err(e) = socket.to(server_room.clone()).emit("voice_state_update", &state).await {
            eprintln!("❌ Failed to broadcast voice_state_update: {}", e);
        }
        if let Err(e) = socket.emit("voice_state_update", &state) {
            eprintln!("❌ Failed to send voice_state_update to sender: {}", e);
        }

        // Notify voice room (for WebRTC)
        if let Err(e) = socket.to(room).emit("user_joined_voice", &data.user_id).await {
            eprintln!("❌ Failed to broadcast user_joined_voice: {}", e);
        }
    });

    socket.on("leave_voice", |socket: SocketRef, Data::<LeaveVoicePayload>(data), State::<Arc<DashMap<String, VoiceState>>>(voice_users)| async move {
        let room = format!("voice:{}", data.channel_id);
        println!("User {} leaving voice channel {}", data.user_id, data.channel_id);
        let _ = socket.leave(room.clone());
        
        // Remove from state
        voice_users.remove(&data.user_id);

        // Notify server room with null channel or just the user_id/server_id to indicate removal?
        // Actually, we can send a special update or just let the frontend handle "if channel_id mismatch or not present"
        // Better to send a "voice_state_remove" or reuse update with null channel?
        // Let's use a specific event or reusing update but with empty channel? 
        // No, let's emit "voice_user_left" to server room.
        let server_room = format!("server:{}", data.server_id);
        if let Err(e) = socket.to(server_room.clone()).emit("voice_user_left", &data).await {
             eprintln!("❌ Failed to broadcast voice_user_left: {}", e);
        }
        if let Err(e) = socket.emit("voice_user_left", &data) {
             eprintln!("❌ Failed to send voice_user_left to sender: {}", e);
        }
        
        if let Err(e) = socket.to(room).emit("user_left_voice", &data.user_id).await {
            eprintln!("❌ Failed to broadcast user_left_voice: {}", e);
        }
    });

    socket.on("voice_mute", |socket: SocketRef, Data::<MutePayload>(data), State::<Arc<DashMap<String, VoiceState>>>(voice_users)| async move {
        if let Some(mut state) = voice_users.get_mut(&data.user_id) {
            state.muted = data.muted;
            let updated_state = state.clone();
            
            // Broadcast update to server room
            let server_room = format!("server:{}", data.server_id);
            if let Err(e) = socket.to(server_room.clone()).emit("voice_state_update", &updated_state).await {
                eprintln!("❌ Failed to broadcast voice_state_update (mute): {}", e);
            }
            if let Err(e) = socket.emit("voice_state_update", &updated_state) {
                eprintln!("❌ Failed to send voice_state_update (mute) to sender: {}", e);
            }
        }
    });

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignalPayload {
    pub target_user_id: String,
    pub signal: serde_json::Value,
    pub sender_id: String,
}

    socket.on("offer", |socket: SocketRef, Data::<SignalPayload>(data)| async move {
        // We assume the client joins "user:{user_id}" room
        let target_room = format!("user:{}", data.target_user_id);
        // We need the sender ID. In a real app, we'd extract it from auth/socket data.
        // Here we rely on the payload or we could pass it if we had auth context in socket.
        // For now, let's assume the frontend sends it or we pass it through.
        // But wait, `data.sender_id` is Option and skip_deserializing. 
        // We should probably change the struct or use a different payload for emitting.
        // Let's rely on the frontend passing the sender_id in the payload for now 
        // OR better, trust the sender if we have auth. 
        // To keep it simple and consistent with previous code, let's just forward the signal 
        // but we need to know who sent it.
        // Let's modify SignalPayload to include sender_id as required for now?
        // Or better, add a field `sender_id` to the emitted event.
        
        println!("Relaying offer to {}", data.target_user_id);
        if let Err(e) = socket.to(target_room).emit("offer", &data).await {
            eprintln!("❌ Failed to relay offer: {}", e);
        }
    });

    socket.on("answer", |socket: SocketRef, Data::<SignalPayload>(data)| async move {
        let target_room = format!("user:{}", data.target_user_id);
        println!("Relaying answer to {}", data.target_user_id);
        if let Err(e) = socket.to(target_room).emit("answer", &data).await {
             eprintln!("❌ Failed to relay answer: {}", e);
        }
    });

    socket.on("ice_candidate", |socket: SocketRef, Data::<SignalPayload>(data)| async move {
        let target_room = format!("user:{}", data.target_user_id);
        println!("Relaying ice_candidate to {}", data.target_user_id);
        if let Err(e) = socket.to(target_room).emit("ice_candidate", &data).await {
             eprintln!("❌ Failed to relay ice_candidate: {}", e);
        }
    });

    socket.on("leave", |socket: SocketRef, Data::<String>(room)| async move {
        println!("Socket {} leaving room '{}'", socket.id, room);
        let _ = socket.leave(room.clone());
    });

    socket.on("typing", |socket: SocketRef, Data::<TypingPayload>(data)| async move {
        println!("👤 User {} is typing in channel {}", data.author, data.channel_id);
        if let Err(e) = socket.to(data.channel_id.clone()).emit("typing", &data).await {
            eprintln!("❌ Failed to broadcast typing event: {}", e);
        }
    });

    socket.on("stop_typing", |socket: SocketRef, Data::<StopTypingPayload>(data)| async move {
        println!("👤 User {} stopped typing in channel {}", data.author, data.channel_id);
        if let Err(e) = socket.to(data.channel_id.clone()).emit("stop_typing", &data).await {
            eprintln!("❌ Failed to broadcast stop_typing event: {}", e);
        }
    });

    socket.on("send_message", |socket: SocketRef, Data::<SendMessagePayload>(data), State::<sqlx::PgPool>(pool)| async move {
        println!("Received message from {}: {}", data.author, data.content);
        
        if let Ok(channel_id_uuid) = uuid::Uuid::parse_str(&data.channel_id) {
            if let Ok(Some(channel)) = sqlx::query_as::<_, crate::models::channel::Channel>(
                "SELECT * FROM channels WHERE id = $1"
            )
            .bind(&channel_id_uuid)
            .fetch_optional(&pool)
            .await {
                match channel.kind {
                    crate::models::channel::ChannelType::Text | crate::models::channel::ChannelType::Voice => {
                        if channel.name.as_ref().map(|n| n.contains("arrivées") || n.contains("départs")).unwrap_or(false) {
                            if let Some(server_id) = channel.server_id {
                                if let Ok(Some(user)) = sqlx::query_as::<_, crate::models::user::User>(
                                    "SELECT * FROM users WHERE username = $1"
                                )
                                .bind(&data.author)
                                .fetch_optional(&pool)
                                .await {
                                    if let Ok(Some(role)) = crate::services::permission::get_user_role(&pool, user.id, server_id).await {
                                        use crate::services::permission::UserRole;
                                        if role != UserRole::Owner && role != UserRole::Admin {
                                            eprintln!("❌ User {} attempted to write in system channel", data.author);
                                            return;
                                        }
                                    } else {
                                        eprintln!("❌ User {} has no role in server", data.author);
                                        return;
                                    }
                                }
                            }
                        }
                    },
                    crate::models::channel::ChannelType::Dm => {
                        let is_subscriber = sqlx::query("SELECT 1 FROM channel_subscribers cs JOIN users u ON cs.user_id = u.id WHERE cs.channel_id = $1 AND u.username = $2")
                            .bind(&channel_id_uuid)
                            .bind(&data.author)
                            .fetch_optional(&pool)
                            .await
                            .map(|opt| opt.is_some())
                            .unwrap_or(false);
                        
                        if !is_subscriber {
                            eprintln!("❌ User {} attempted to write in DM channel {} without being a subscriber", data.author, data.channel_id);
                            return;
                        }
                    }
                }
            }
        }
        
        let created_at = chrono::Utc::now().timestamp_millis();
        
        let result = sqlx::query_as::<_, ChatMessage>(
            "INSERT INTO messages (channel_id, author, content, created_at) VALUES ($1, $2, $3, $4) RETURNING id, channel_id, author, content, created_at"
        )
        .bind(&data.channel_id)
        .bind(&data.author)
        .bind(&data.content)
        .bind(created_at)
        .fetch_one(&pool)
        .await;

        match result {
            Ok(msg) => {
                println!("✅ Message saved. ID: {}. Broadcasting to room '{}'", msg.id, data.channel_id);
                
                if let Err(e) = socket.emit("message", &msg) {
                     eprintln!("❌ Failed to emit to sender: {}", e);
                } else {
                     println!("   -> Sent to sender");
                }

                if let Err(e) = socket.to(data.channel_id.clone()).emit("message", &msg).await {
                    eprintln!("❌ Failed to broadcast to room '{}': {}", data.channel_id, e);
                } else {
                    println!("   -> Broadcasted to room '{}'", data.channel_id);
                }
            }
            Err(e) => {
                eprintln!("Failed to save message: {}", e);
            }
        }
    });

    socket.on("disconnect", |socket: SocketRef, State::<Arc<DashMap<String, VoiceState>>>(voice_users)| async move {
        let socket_id = socket.id.to_string();
        // println!("Socket disconnected: {}", socket_id);
        
        // Find user by socket_id
        let mut user_to_remove = None;
        
        for entry in voice_users.iter() {
            if let Some(sid) = &entry.value().socket_id {
                if sid == &socket_id {
                    user_to_remove = Some(entry.value().clone());
                    break;
                }
            }
        }

        if let Some(state) = user_to_remove {
            println!("Cleaning up voice state for disconnected user {}", state.user_id);
            voice_users.remove(&state.user_id);

            let payload = LeaveVoicePayload {
                channel_id: state.channel_id.clone(),
                user_id: state.user_id.clone(),
                server_id: state.server_id.clone(),
            };

            // Notify server room
            let server_room = format!("server:{}", state.server_id);
            if let Err(e) = socket.to(server_room).emit("voice_user_left", &payload).await {
                eprintln!("Failed to broadcast voice_user_left on disconnect: {}", e);
            }
            
            // Notify voice room
            let voice_room = format!("voice:{}", state.channel_id);
            if let Err(e) = socket.to(voice_room).emit("user_left_voice", &state.user_id).await {
                eprintln!("Failed to broadcast user_left_voice on disconnect: {}", e);
            }
        }
    });
}

pub async fn broadcast_channel_created(io: &socketioxide::SocketIo, server_id: Uuid, channel: Channel) {
    let payload = ChannelCreatedPayload {
        channel,
        server_id,
    };
    let room = format!("server:{}", server_id);
    println!("Broadcasting channel_created to room '{}'", room);
    if let Err(e) = io.to(room).emit("channel_created", &payload).await {
        eprintln!("Failed to broadcast channel_created: {}", e);
    }
}

pub async fn broadcast_channel_deleted(io: &socketioxide::SocketIo, server_id: Uuid, channel_id: Uuid) {
    let payload = ChannelDeletedPayload {
        channel_id,
        server_id,
    };
    let room = format!("server:{}", server_id);
    println!("Broadcasting channel_deleted to room '{}'", room);
    if let Err(e) = io.to(room).emit("channel_deleted", &payload).await {
        eprintln!("Failed to broadcast channel_deleted: {}", e);
    }
}

pub async fn notify_member_removed(io: &socketioxide::SocketIo, server_id: Uuid, user_id: Uuid) {
    let payload = ServerMemberRemovedPayload {
        server_id,
        user_id,
    };
    let room = format!("user:{}", user_id);
    println!("Notifying user {} about removal from server {}", user_id, server_id);
    if let Err(e) = io.to(room).emit("server_member_removed", &payload).await {
        eprintln!("Failed to notify member removal: {}", e);
    }
}

pub async fn broadcast_message_deleted(io: &socketioxide::SocketIo, channel_id: String, message_id: i64) {
    #[derive(Serialize)]
    struct MessageDeletedPayload {
        #[serde(rename = "channelId")]
        channel_id: String,
        #[serde(rename = "messageId")]
        message_id: i64,
    }
    
    let payload = MessageDeletedPayload {
        channel_id: channel_id.clone(),
        message_id,
    };
    
    println!("Broadcasting message_deleted to channel '{}'", channel_id);
    if let Err(e) = io.to(channel_id).emit("message_deleted", &payload).await {
        eprintln!("Failed to broadcast message_deleted: {}", e);
    }
}

pub async fn broadcast_message_updated(io: &socketioxide::SocketIo, message: ChatMessage) {
    println!("Broadcasting message_updated to channel '{}'", message.channel_id);
    if let Err(e) = io.to(message.channel_id.clone()).emit("message_updated", &message).await {
        eprintln!("Failed to broadcast message_updated: {}", e);
    }
}

pub async fn broadcast_user_status_changed(
    io: &socketioxide::SocketIo,
    server_id: uuid::Uuid,
    user_id: uuid::Uuid,
    status: crate::models::user::UserStatus,
) {
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct UserStatusChangedPayload {
        user_id: String,
        status: crate::models::user::UserStatus,
        server_id: String,
    }

    let payload = UserStatusChangedPayload {
        user_id: user_id.to_string(),
        status,
        server_id: server_id.to_string(),
    };

    let room = format!("server:{}", server_id);
    println!("Broadcasting user_status_changed to room '{}'", room);
    if let Err(e) = io.to(room).emit("user_status_changed", &payload).await {
        eprintln!("Failed to broadcast user_status_changed: {}", e);
    }
}

pub async fn broadcast_user_updated(
    io: &socketioxide::SocketIo,
    server_id: uuid::Uuid,
    user: crate::models::user::PublicUser,
) {
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct UserUpdatedPayload {
        user: crate::models::user::PublicUser,
        server_id: String,
    }

    let payload = UserUpdatedPayload {
        user: user.clone(),
        server_id: server_id.to_string(),
    };

    let room = format!("server:{}", server_id);
    println!("Broadcasting user_updated to room '{}'", room);
    if let Err(e) = io.to(room).emit("user_updated", &payload).await {
        eprintln!("Failed to broadcast user_updated: {}", e);
    }
}
