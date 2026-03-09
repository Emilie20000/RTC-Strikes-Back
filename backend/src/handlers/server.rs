use axum::{
    extract::{State, Path},
    http::StatusCode,
    Extension,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    models::server::{Server, CreateServer, UpdateServer, ServerMember},
    services::{
        server as server_service,
        permission::UserRole,
    },
    middleware::auth::AuthUser,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct JoinServerPayload {
    pub invite_code: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMemberRolePayload {
    pub role: UserRole,
}

#[derive(Debug, Deserialize)]
pub struct BanUserPayload {
    pub user_id: Uuid,
    pub reason: Option<String>,
}

// Créer un serveur
pub async fn create_server(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateServer>,
) -> Result<(StatusCode, Json<Server>), (StatusCode, Json<serde_json::Value>)> {
    let server = server_service::create_server(&state.pool, auth_user.user_id, payload)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to create server: {}", e)})),
            )
        })?;
    
    Ok((StatusCode::CREATED, Json(server)))
}

// Récup tous les serveurs de l'utilisateur
pub async fn get_my_servers(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Server>>, (StatusCode, Json<serde_json::Value>)> {
    let servers = server_service::get_user_servers(&state.pool, auth_user.user_id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Database error: {}", e)})),
            )
        })?;
    
    Ok(Json(servers))
}

// Récupère un serveur par ID
pub async fn get_server(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<Json<Server>, (StatusCode, Json<serde_json::Value>)> {
    let server = server_service::get_server_by_id(&state.pool, server_id, auth_user.user_id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Database error: {}", e)})),
            )
        })?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Server not found or you're not a member"})),
            )
        })?;
    
    Ok(Json(server))
}

// Mettre à jour un serveur
pub async fn update_server(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<UpdateServer>,
) -> Result<Json<Server>, (StatusCode, Json<serde_json::Value>)> {
    let server = server_service::update_server(&state.pool, server_id, auth_user.user_id, payload)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => {
                (
                    StatusCode::FORBIDDEN,
                    Json(json!({"error": "Only the owner can update the server"})),
                )
            },
            _ => {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("Failed to update server: {}", e)})),
                )
            }
        })?;
    
    Ok(Json(server))
}

// Supprimer un serveur
pub async fn delete_server(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    server_service::delete_server(&state.pool, server_id, auth_user.user_id)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => {
                (
                    StatusCode::FORBIDDEN,
                    Json(json!({"error": "Action impossible : vous n'êtes pas le propriétaire ou il reste encore des membres dans le serveur."})),
                )
            },
            _ => {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("Failed to delete server: {}", e)})),
                )
            }
        })?;
    
    Ok(StatusCode::NO_CONTENT)
}

// Rejoindre un serveur via code d'invitation
pub async fn join_server(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<JoinServerPayload>,
) -> Result<Json<Server>, (StatusCode, Json<serde_json::Value>)> {
    let server = server_service::join_server(&state.pool, auth_user.user_id, payload.invite_code)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => {
                (
                    StatusCode::NOT_FOUND,
                    Json(json!({"error": "Invalid invite code"})),
                )
            },
            _ => {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("Failed to join server: {}", e)})),
                )
            }
        })?;
    
    let arrivals_channel = sqlx::query_as::<_, crate::models::channel::Channel>(
        "SELECT * FROM channels WHERE server_id = $1 AND name LIKE '%arrivées' LIMIT 1"
    )
    .bind(&server.id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();
    
    if let Some(channel) = arrivals_channel {
        let user = sqlx::query_as::<_, crate::models::user::User>(
            "SELECT * FROM users WHERE id = $1"
        )
        .bind(&auth_user.user_id)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten();
        
        if let Some(user) = user {
            let welcome_message = server_service::format_welcome_message(&user.username);
            if let Ok(msg) = server_service::post_system_message(&state.pool, channel.id, welcome_message).await {
                let _ = state.io.to(msg.channel_id.clone()).emit("message", &msg).await;
            }
        }
    }
    
    Ok(Json(server))
}

// Retirer un membre du serveur
pub async fn remove_member(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((server_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    server_service::remove_member(&state.pool, server_id, auth_user.user_id, user_id)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => {
                (
                    StatusCode::FORBIDDEN,
                    Json(json!({"error": "You don't have permission to remove members"})),
                )
            },
            _ => {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("Failed to remove member: {}", e)})),
                )
            }
        })?;
    
    let departures_channel = sqlx::query_as::<_, crate::models::channel::Channel>(
        "SELECT * FROM channels WHERE server_id = $1 AND name LIKE '%départs' LIMIT 1"
    )
    .bind(&server_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();
    
    if let Some(channel) = departures_channel {
        let user = sqlx::query_as::<_, crate::models::user::User>(
            "SELECT * FROM users WHERE id = $1"
        )
        .bind(&user_id)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten();
        
        if let Some(user) = user {
            let goodbye_message = server_service::format_goodbye_message(&user.username);
            if let Ok(msg) = server_service::post_system_message(&state.pool, channel.id, goodbye_message).await {
                let _ = state.io.to(msg.channel_id.clone()).emit("message", &msg).await;
            }
        }
    }
    
    crate::socket::notify_member_removed(&state.io, server_id, user_id).await;
    
    Ok(StatusCode::NO_CONTENT)
}

// Changer le rôle d'un membre
pub async fn update_member_role(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((server_id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateMemberRolePayload>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    server_service::update_member_role(&state.pool, server_id, auth_user.user_id, user_id, payload.role)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => {
                (
                    StatusCode::FORBIDDEN,
                    Json(json!({"error": "Only the owner can change member roles"})),
                )
            },
            _ => {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("Failed to update role: {}", e)})),
                )
            }
        })?;
    
    Ok(StatusCode::NO_CONTENT)
}

// Bannir un utilisateur
pub async fn ban_user(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<BanUserPayload>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    server_service::ban_user(&state.pool, server_id, auth_user.user_id, payload.user_id, payload.reason)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => {
                (
                    StatusCode::FORBIDDEN,
                    Json(json!({"error": "Only the owner can ban users"})),
                )
            },
            _ => {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("Failed to ban user: {}", e)})),
                )
            }
        })?;
    
    // gestion des messages lors dun bannissement 
    let departures_channel = sqlx::query_as::<_, crate::models::channel::Channel>(
        "SELECT * FROM channels WHERE server_id = $1 AND name LIKE '%départs' LIMIT 1"
    )
    .bind(&server_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();
    
    if let Some(channel) = departures_channel {
        let user = sqlx::query_as::<_, crate::models::user::User>(
            "SELECT * FROM users WHERE id = $1"
        )
        .bind(&payload.user_id)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten();
        
        if let Some(user) = user {
            let ban_message = server_service::format_ban_message(&user.username);
            if let Ok(msg) = server_service::post_system_message(&state.pool, channel.id, ban_message).await {
                let _ = state.io.to(msg.channel_id.clone()).emit("message", &msg).await;
            }
        }
    }
    
    crate::socket::notify_member_removed(&state.io, server_id, payload.user_id).await;
    
    Ok(StatusCode::NO_CONTENT)
}

// Débannir un utilisateur
pub async fn unban_user(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((server_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    server_service::unban_user(&state.pool, server_id, auth_user.user_id, user_id)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => {
                (
                    StatusCode::FORBIDDEN,
                    Json(json!({"error": "You don't have permission to unban users"})),
                )
            },
            _ => {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("Failed to unban user: {}", e)})),
                )
            }
        })?;
    
    Ok(StatusCode::NO_CONTENT)
}

// Récupérer les membres d'un serveur
pub async fn get_server_members(
    State(state): State<Arc<AppState>>,
    Extension(_auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<Json<Vec<ServerMember>>, (StatusCode, Json<serde_json::Value>)> {
    let members = server_service::get_server_members(&state.pool, server_id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to fetch members: {}", e)})),
            )
        })?;
    
    Ok(Json(members))
}
