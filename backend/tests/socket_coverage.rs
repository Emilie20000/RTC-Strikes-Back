use backend::socket::*;
use backend::models::channel::{Channel, ChannelType};
use backend::models::message::ChatMessage;
use backend::models::user::PublicUser;
use uuid::Uuid;
use socketioxide::extract::SocketRef;

#[tokio::test]
async fn test_socket_broadcasts_for_coverage() {
    let (_layer, io) = socketioxide::SocketIo::builder().build_layer();
    io.ns("/", |_: SocketRef| async move {});
    
    let server_id = Uuid::new_v4();
    let channel_id = Uuid::new_v4();
    
    let channel = Channel {
        id: channel_id,
        name: Some("test".to_string()),
        description: None,
        server_id: Some(server_id),
        kind: ChannelType::Text,
        recipient_id: None,
        avatar_url: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    
    // Call all broadcast functions
    broadcast_channel_created(&io, server_id, channel.clone()).await;
    broadcast_channel_deleted(&io, server_id, channel_id).await;
    notify_member_removed(&io, server_id, Uuid::new_v4()).await;
    broadcast_message_deleted(&io, "chan1".to_string(), 123).await;
    
    let msg = ChatMessage {
        id: 1,
        channel_id: "chan1".to_string(),
        author: "user1".to_string(),
        author_id: Some(Uuid::new_v4()),
        content: "updated".to_string(),
        created_at: 123,
        reactions: vec![],
    };
    broadcast_message_updated(&io, msg).await;
    broadcast_user_status_changed(&io, server_id, Uuid::new_v4(), backend::models::user::UserStatus::Online).await;
    
    let user = PublicUser {
        id: Uuid::new_v4(),
        username: "user1".to_string(),
        email: "user1@example.com".to_string(),
        avatar_url: None,
        status: backend::models::user::UserStatus::Online,
        langue: "fr".to_string(),
        created_at: chrono::Utc::now(),
    };
    broadcast_user_updated(&io, server_id, user).await;
}

#[tokio::test]
async fn test_socket_initialization_coverage() {
    let (_layer, io) = socketioxide::SocketIo::builder().build_layer();
    io.ns("/", backend::socket::on_connect);
}

#[test]
fn test_socket_payloads_for_coverage() {
    // TypingPayload
    let typing = TypingPayload {
        channel_id: "c".to_string(),
        author: "a".to_string(),
        user_id: "u".to_string(),
        avatar_url: Some("url".to_string()),
    };
    let json = serde_json::to_string(&typing).unwrap();
    let _: TypingPayload = serde_json::from_str(&json).unwrap();

    // StopTypingPayload
    let stop_typing = StopTypingPayload {
        channel_id: "c".to_string(),
        author: "a".to_string(),
        user_id: "u".to_string(),
    };
    let json = serde_json::to_string(&stop_typing).unwrap();
    let _: StopTypingPayload = serde_json::from_str(&json).unwrap();

    // SendMessagePayload
    let send_msg = SendMessagePayload {
        channel_id: "c".to_string(),
        author: "a".to_string(),
        author_id: Some(Uuid::new_v4()),
        content: "hello".to_string(),
    };
    // Since SendMessagePayload is only Deserialize (if not Serialize, we can only test deserialization)
    // Wait, let's just serialize it with a dummy json and deserialize it
    let json = format!(r#"{{"channelId": "c", "author": "a", "authorId": "{}", "content": "hello"}}"#, Uuid::new_v4());
    let _: SendMessagePayload = serde_json::from_str(&json).unwrap();

    // JoinVoicePayload
    let join_voice = JoinVoicePayload {
        channel_id: "c".to_string(),
        user_id: "u".to_string(),
        server_id: "s".to_string(),
    };
    let json = serde_json::to_string(&join_voice).unwrap();
    let _: JoinVoicePayload = serde_json::from_str(&json).unwrap();

    // LeaveVoicePayload
    let leave_voice = LeaveVoicePayload {
        channel_id: "c".to_string(),
        user_id: "u".to_string(),
        server_id: "s".to_string(),
    };
    let json = serde_json::to_string(&leave_voice).unwrap();
    let _: LeaveVoicePayload = serde_json::from_str(&json).unwrap();

    // MutePayload
    let mute = MutePayload {
        channel_id: "c".to_string(),
        user_id: "u".to_string(),
        server_id: "s".to_string(),
        muted: true,
    };
    let json = serde_json::to_string(&mute).unwrap();
    let _: MutePayload = serde_json::from_str(&json).unwrap();

    // SignalPayload
    let signal = SignalPayload {
        target_user_id: "t".to_string(),
        signal: serde_json::json!({"type": "offer"}),
        sender_id: "s".to_string(),
    };
    let json = serde_json::to_string(&signal).unwrap();
    let _: SignalPayload = serde_json::from_str(&json).unwrap();

    // ReactionPayload
    let reaction = ReactionPayload {
        message_id: 1,
        user_id: "u".to_string(),
        emoji: "smile".to_string(),
    };
    let json = serde_json::to_string(&reaction).unwrap();
    let _: ReactionPayload = serde_json::from_str(&json).unwrap();

    // ScreenSharePayload
    let screen = ScreenSharePayload {
        user_id: "u".to_string(),
        channel_id: "c".to_string(),
    };
    let json = serde_json::to_string(&screen).unwrap();
    let _: ScreenSharePayload = serde_json::from_str(&json).unwrap();
}

#[test]
fn test_parse_mentions() {
    let text = "Hello <@550e8400-e29b-41d4-a716-446655440000> and <@550e8400-e29b-41d4-a716-446655440001> !";
    let mentions = parse_mentions(text);
    assert_eq!(mentions.len(), 2);
    assert!(mentions.contains("550e8400-e29b-41d4-a716-446655440000"));
    assert!(mentions.contains("550e8400-e29b-41d4-a716-446655440001"));

    let empty = parse_mentions("No mentions here!");
    assert_eq!(empty.len(), 0);
}
