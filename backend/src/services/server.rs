use sqlx::PgPool;
use uuid::Uuid;
use rand::Rng;
use crate::models::message::ChatMessage;

use crate::{
    models::server::{Server, CreateServer, UpdateServer, ServerMember},
    services::permission::{self, UserRole},
};

// Génère un code d'invitation aléatoire de 8 caractères
pub fn generate_invite_code() -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();
    
    (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

// Logic to check if a user can remove another user
pub fn can_remove_member_check(requester_role: UserRole, target_role: UserRole) -> bool {
    match requester_role {
        UserRole::Owner => true, // Owner can remove anyone
        UserRole::Admin => target_role == UserRole::Member, // Admin can only remove Members
        UserRole::Member => false, // Members cannot remove anyone
    }
}

// Logic to check if a user can ban another user
pub fn can_ban_user_check(requester_role: UserRole, target_role: UserRole) -> bool {
    // Only Admin or Owner can ban
    if !matches!(requester_role, UserRole::Admin | UserRole::Owner) {
        return false;
    }
    
    // Cannot ban Owner
    if target_role == UserRole::Owner {
        return false;
    }
    
    true
}

// Créer un nouveau serveur
pub async fn create_server(
    pool: &PgPool,
    owner_id: Uuid,
    payload: CreateServer,
) -> Result<Server, sqlx::Error> {
    let invite_code = generate_invite_code();
    let is_public = payload.is_public.unwrap_or(false);
    
    let mut tx = pool.begin().await?;
    
    // Créer le serveur
    let server = sqlx::query_as::<_, Server>(
        r#"
        INSERT INTO servers (name, description, invite_code, is_public, owner_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, description, icon_url, invite_code, is_public, owner_id, created_at, updated_at
        "#
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&invite_code)
    .bind(is_public)
    .bind(&owner_id)
    .fetch_one(&mut *tx)
    .await?;
    
    // Ajouter le créateur comme owner dans server_members
    sqlx::query(
        r#"
        INSERT INTO server_members (server_id, user_id, role)
        VALUES ($1, $2, $3)
        "#
    )
    .bind(&server.id)
    .bind(&owner_id)
    .bind(UserRole::Owner)
    .execute(&mut *tx)
    .await?;
    
    // Créer automatiquement les salons "arrivées" et "départs"
    sqlx::query(
        r#"
        INSERT INTO channels (name, description, kind, server_id)
        VALUES 
            ('📥-arrivées', 'Bienvenue aux nouveaux membres !', 'TEXT', $1),
            ('📤-départs', 'Au revoir aux membres partis', 'TEXT', $1)
        "#
    )
    .bind(&server.id)
    .execute(&mut *tx)
    .await?;
    
    tx.commit().await?;
    
    Ok(server)
}

// Récupérer tous les serveurs d'un utilisateur
pub async fn get_user_servers(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<Server>, sqlx::Error> {
    sqlx::query_as::<_, Server>(
        r#"
        SELECT s.id, s.name, s.description, s.icon_url, s.invite_code, 
               s.is_public, s.owner_id, s.created_at, s.updated_at
        FROM servers s
        INNER JOIN server_members sm ON s.id = sm.server_id
        WHERE sm.user_id = $1
        ORDER BY s.created_at DESC
        "#
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await
}

// Récupérer un serveur par ID (vérifie si membre)
pub async fn get_server_by_id(
    pool: &PgPool,
    server_id: Uuid,
    user_id: Uuid,
) -> Result<Option<Server>, sqlx::Error> {
    // Vérifier si membre
    let is_member = permission::is_server_member(pool, user_id, server_id).await?;
    if !is_member {
        return Ok(None);
    }

    sqlx::query_as::<_, Server>(
        r#"
        SELECT * FROM servers WHERE id = $1
        "#
    )
    .bind(server_id)
    .fetch_optional(pool)
    .await
}

// Mettre à jour un serveur
pub async fn update_server(
    pool: &PgPool,
    server_id: Uuid,
    user_id: Uuid,
    payload: UpdateServer,
) -> Result<Server, sqlx::Error> {
    // Vérifier les permissions (Admin ou Owner)
    let is_authorized = permission::is_admin_or_owner(pool, user_id, server_id).await?;
    if !is_authorized {
        return Err(sqlx::Error::RowNotFound); // Ou une erreur personnalisée si possible
    }

    let server = sqlx::query_as::<_, Server>(
        r#"
        UPDATE servers 
        SET 
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            icon_url = COALESCE($3, icon_url),
            is_public = COALESCE($4, is_public),
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
        "#
    )
    .bind(payload.name)
    .bind(payload.description)
    .bind(payload.icon_url)
    .bind(payload.is_public)
    .bind(server_id)
    .fetch_one(pool)
    .await?;
    
    Ok(server)
}

// Supprimer un serveur
pub async fn delete_server(
    pool: &PgPool,
    server_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    // Vérifier les permissions (Owner seulement pour supprimer)
    let is_owner = permission::is_owner(pool, user_id, server_id).await?;
    if !is_owner {
        return Err(sqlx::Error::RowNotFound);
    }

    let member_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM server_members WHERE server_id = $1")
        .bind(server_id)
        .fetch_one(pool)
        .await?;

    if member_count > 1 {
        return Err(sqlx::Error::RowNotFound); 
    }

    sqlx::query("DELETE FROM servers WHERE id = $1")
        .bind(server_id)
        .execute(pool)
        .await?;
    
    Ok(())
}

// Rejoindre un serveur via code d'invitation
pub async fn join_server(
    pool: &PgPool,
    user_id: Uuid,
    invite_code: String,
) -> Result<Server, sqlx::Error> {
    let server = sqlx::query_as::<_, Server>(
        "SELECT * FROM servers WHERE invite_code = $1"
    )
    .bind(&invite_code)
    .fetch_optional(pool)
    .await?
    .ok_or(sqlx::Error::RowNotFound)?;
    
    let ban_info = sqlx::query_as::<_, (Option<chrono::DateTime<chrono::Utc>>, Option<String>)>(
        "SELECT expires_at, reason FROM server_bans WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server.id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    if let Some((expires_at, reason)) = ban_info {
        if let Some(expires) = expires_at {
            if expires > chrono::Utc::now() {
                let remaining = expires - chrono::Utc::now();
                let hours = remaining.num_hours();
                let minutes = remaining.num_minutes() % 60;
                let message = format!(
                    "BANNED:Vous êtes banni de ce serveur pendant encore {}{} minutes.",
                    if hours > 0 { format!("{} heures et ", hours) } else { "".to_string() },
                    minutes
                );
                return Err(sqlx::Error::Protocol(message)); 
            } else {
                // Ban expired, remove it
                sqlx::query("DELETE FROM server_bans WHERE server_id = $1 AND user_id = $2")
                    .bind(server.id)
                    .bind(user_id)
                    .execute(pool)
                    .await?;
            }
        } else {
            // Permanent ban
            let message = format!(
                "BANNED:Vous êtes banni de ce serveur de façon permanente. Raison : {}",
                reason.unwrap_or_else(|| "Aucune raison fournie".to_string())
            );
            return Err(sqlx::Error::Protocol(message));
        }
    }
    
    let is_member = sqlx::query(
        "SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server.id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    
    if is_member.is_some() {
        return Ok(server); // Déjà membre, on retourne juste le serveur
    }
    
    // 4. Ajouter le membre
    sqlx::query(
        "INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, $3)"
    )
    .bind(server.id)
    .bind(user_id)
    .bind(UserRole::Member)
    .execute(pool)
    .await?;
    
    Ok(server)
}

// Vérifier le rôle d'un utilisateur dans un serveur
pub async fn get_user_role(
    pool: &PgPool,
    server_id: Uuid,
    user_id: Uuid,
) -> Result<Option<UserRole>, sqlx::Error> {
    let result = sqlx::query_as::<_, (UserRole,)>(
        "SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(&server_id)
    .bind(&user_id)
    .fetch_optional(pool)
    .await?;
    
    Ok(result.map(|(role,)| role))
}

// Retirer un membre (Owner ou Admin)
pub async fn remove_member(
    pool: &PgPool,
    server_id: Uuid,
    user_id: Uuid,
    target_user_id: Uuid,
) -> Result<(), sqlx::Error> {
    // Si l'utilisateur essaie de se retirer lui-même (Quitter le serveur)
    if user_id == target_user_id {
        let role = get_user_role(pool, server_id, user_id).await?
            .ok_or(sqlx::Error::RowNotFound)?;
        
        // Un Owner ne peut pas quitter sans transférer la propriété
        if role == UserRole::Owner {
            return Err(sqlx::Error::RowNotFound);
        }

        sqlx::query(
            "DELETE FROM server_members WHERE server_id = $1 AND user_id = $2"
        )
        .bind(&server_id)
        .bind(&target_user_id)
        .execute(pool)
        .await?;
        
        return Ok(());
    }

    // Sinon, c'est une tentative d'expulsion (Kick)
    let requester_role = get_user_role(pool, server_id, user_id).await?
        .ok_or(sqlx::Error::RowNotFound)?;
    
    if requester_role != UserRole::Owner && requester_role != UserRole::Admin {
        return Err(sqlx::Error::RowNotFound);
    }
    
    let target_role = get_user_role(pool, server_id, target_user_id).await?
        .ok_or(sqlx::Error::RowNotFound)?;
    
    if target_role == UserRole::Owner {
        return Err(sqlx::Error::RowNotFound);
    }

    if requester_role == UserRole::Admin && target_role == UserRole::Admin {
        return Err(sqlx::Error::RowNotFound); 
    }
    
    sqlx::query(
        "DELETE FROM server_members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(&server_id)
    .bind(&target_user_id)
    .execute(pool)
    .await?;
    
    Ok(())
}

// Bannir un utilisateur (Owner ou Admin)
pub async fn ban_user(
    pool: &PgPool,
    server_id: Uuid,
    owner_id: Uuid,
    target_user_id: Uuid,
    reason: Option<String>,
    duration_hours: Option<i32>,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    let requester_role_opt = sqlx::query_as::<_, (UserRole,)>(
        "SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(&server_id)
    .bind(&owner_id)
    .fetch_optional(&mut *tx)
    .await?;
    
    let requester_role = match requester_role_opt {
        Some((role,)) => role,
        None => return Err(sqlx::Error::RowNotFound),
    };

    if requester_role != UserRole::Owner && requester_role != UserRole::Admin {
        return Err(sqlx::Error::RowNotFound);
    }

    let target_role_opt = sqlx::query_as::<_, (UserRole,)>(
        "SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(&server_id)
    .bind(&target_user_id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some((target_role,)) = target_role_opt {
        if target_role == UserRole::Owner {
            return Err(sqlx::Error::RowNotFound);
        }
        if requester_role == UserRole::Admin && target_role == UserRole::Admin {
            return Err(sqlx::Error::RowNotFound);
        }
    }
    
    if owner_id == target_user_id {
        return Err(sqlx::Error::RowNotFound);
    }
    
    sqlx::query(
        "DELETE FROM server_members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(&server_id)
    .bind(&target_user_id)
    .execute(&mut *tx)
    .await?;

    let expires_at = duration_hours.map(|h| chrono::Utc::now() + chrono::Duration::hours(h as i64));

    sqlx::query(
        "INSERT INTO server_bans (server_id, user_id, reason, expires_at) VALUES ($1, $2, $3, $4) ON CONFLICT (server_id, user_id) DO UPDATE SET reason = $3, expires_at = $4, banned_at = NOW()"
    )
    .bind(&server_id)
    .bind(&target_user_id)
    .bind(reason)
    .bind(expires_at)
    .execute(&mut *tx)
    .await?;
    
    tx.commit().await?;
    
    Ok(())
}

pub async fn get_server_bans(
    pool: &PgPool,
    server_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<crate::models::server::ServerBan>, sqlx::Error> {
    // Check if authorized (Admin or Owner)
    let is_authorized = permission::is_admin_or_owner(pool, user_id, server_id).await?;
    if !is_authorized {
        return Err(sqlx::Error::RowNotFound);
    }

    sqlx::query_as::<_, crate::models::server::ServerBan>(
        r#"
        SELECT b.server_id, b.user_id, u.username, u.avatar_url, b.reason, b.banned_at, b.expires_at
        FROM server_bans b
        JOIN users u ON b.user_id = u.id
        WHERE b.server_id = $1
        ORDER BY b.banned_at DESC
        "#
    )
    .bind(server_id)
    .fetch_all(pool)
    .await
}

// Débannir un utilisateur (Owner ou Admin)
pub async fn unban_user(
    pool: &PgPool,
    server_id: Uuid,
    owner_id: Uuid,
    target_user_id: Uuid,
) -> Result<(), sqlx::Error> {
    let requester_role = get_user_role(pool, server_id, owner_id).await?
        .ok_or(sqlx::Error::RowNotFound)?;

    if requester_role != UserRole::Owner && requester_role != UserRole::Admin {
        return Err(sqlx::Error::RowNotFound);
    }

    sqlx::query(
        "DELETE FROM server_bans WHERE server_id = $1 AND user_id = $2"
    )
    .bind(&server_id)
    .bind(&target_user_id)
    .execute(pool)
    .await?;
    
    Ok(())
}

pub async fn get_server_members(
    pool: &PgPool,
    server_id: Uuid,
) -> Result<Vec<ServerMember>, sqlx::Error> {
    sqlx::query_as::<_, ServerMember>(
        r#"
        SELECT u.id as user_id, u.username, u.avatar_url, sm.role, u.status, sm.joined_at
        FROM server_members sm
        JOIN users u ON sm.user_id = u.id
        WHERE sm.server_id = $1
        ORDER BY sm.role ASC, u.username ASC
        "#
    )
    .bind(server_id)
    .fetch_all(pool)
    .await
}

// Post a system message (used for welcome/goodbye messages)
pub async fn post_system_message(
    pool: &PgPool,
    channel_id: Uuid,
    content: String,
) -> Result<ChatMessage, sqlx::Error> {
    let created_at = chrono::Utc::now().timestamp_millis();
    
    let msg = sqlx::query_as::<_, ChatMessage>(
        r#"
        INSERT INTO messages (channel_id, author, content, created_at)
        VALUES ($1, 'Système', $2, $3)
        RETURNING id, channel_id::text as channel_id, author, content, created_at
        "#
    )
    .bind(channel_id)
    .bind(content)
    .bind(created_at)
    .fetch_one(pool)
    .await?;
    
    Ok(msg)
}
    
// Changer le rôle d'un membre (Seulement le Owner peut gérer les rôles)
pub async fn update_member_role(
    pool: &PgPool,
    server_id: Uuid,
    owner_id: Uuid,
    target_user_id: Uuid,
    new_role: UserRole,
) -> Result<(), sqlx::Error> {
    let requester_role = get_user_role(pool, server_id, owner_id).await?
        .ok_or(sqlx::Error::RowNotFound)?;
    
    if requester_role != UserRole::Owner {
        return Err(sqlx::Error::RowNotFound);
    }
    
    let _target_current_role = get_user_role(pool, server_id, target_user_id).await?
        .ok_or(sqlx::Error::RowNotFound)?;

    if target_user_id == owner_id {
        return Err(sqlx::Error::RowNotFound);
    }

    if new_role == UserRole::Owner {
        let mut tx = pool.begin().await?;

        sqlx::query(
            "UPDATE server_members SET role = $1 WHERE server_id = $2 AND user_id = $3"
        )
        .bind(UserRole::Owner)
        .bind(&server_id)
        .bind(&target_user_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE server_members SET role = $1 WHERE server_id = $2 AND user_id = $3"
        )
        .bind(UserRole::Member)
        .bind(&server_id)
        .bind(&owner_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE servers SET owner_id = $1 WHERE id = $2"
        )
        .bind(&target_user_id)
        .bind(&server_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
    } else {
        sqlx::query(
            "UPDATE server_members SET role = $1 WHERE server_id = $2 AND user_id = $3"
        )
        .bind(&new_role)
        .bind(&server_id)
        .bind(&target_user_id)
        .execute(pool)
        .await?;
    }
    
    Ok(())
}

pub fn format_welcome_message(username: &str) -> String {
    format!("🎉 **{}** a rejoint le serveur !", username)
}

pub fn format_goodbye_message(username: &str) -> String {
    format!("👋 **{}** a quitté le serveur", username)
}

pub fn format_ban_message(username: &str) -> String {
    format!("🔨 **{}** a été banni du serveur", username)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json;

    #[test]
    fn test_invite_code_generation() {
        let code1 = generate_invite_code();
        let code2 = generate_invite_code();

        assert_eq!(code1.len(), 8);
        assert_eq!(code2.len(), 8);
        assert_ne!(code1, code2);
        
        let allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        for c in code1.chars() {
            assert!(allowed.contains(c));
        }
    }

    #[test]
    fn test_can_remove_member_logic() {
        // Owner can remove anyone
        assert!(can_remove_member_check(UserRole::Owner, UserRole::Owner));
        assert!(can_remove_member_check(UserRole::Owner, UserRole::Admin));
        assert!(can_remove_member_check(UserRole::Owner, UserRole::Member));
        
        // Admin can remove Member but not Owner/Admin
        assert!(!can_remove_member_check(UserRole::Admin, UserRole::Owner));
        assert!(!can_remove_member_check(UserRole::Admin, UserRole::Admin));
        assert!(can_remove_member_check(UserRole::Admin, UserRole::Member));
        
        // Member cannot remove anyone
        assert!(!can_remove_member_check(UserRole::Member, UserRole::Owner));
        assert!(!can_remove_member_check(UserRole::Member, UserRole::Admin));
        assert!(!can_remove_member_check(UserRole::Member, UserRole::Member));
    }
    
    #[test]
    fn test_can_ban_user_logic() {
        // Owner can ban anyone (except Owner check inside function)
        assert!(!can_ban_user_check(UserRole::Owner, UserRole::Owner));
        assert!(can_ban_user_check(UserRole::Owner, UserRole::Admin));
        assert!(can_ban_user_check(UserRole::Owner, UserRole::Member));
        
        // Admin can ban anyone except Owner
        assert!(can_ban_user_check(UserRole::Admin, UserRole::Admin)); 
        assert!(!can_ban_user_check(UserRole::Admin, UserRole::Owner));
        assert!(can_ban_user_check(UserRole::Admin, UserRole::Member));
        
        // Member cannot ban
        assert!(!can_ban_user_check(UserRole::Member, UserRole::Owner));
        assert!(!can_ban_user_check(UserRole::Member, UserRole::Admin));
        assert!(!can_ban_user_check(UserRole::Member, UserRole::Member));
    }

    #[test]
    fn test_server_member_serialization() {
         let member = ServerMember {
             user_id: Uuid::new_v4(),
             username: "test".to_string(),
             avatar_url: None,
             role: UserRole::Member,
             status: crate::models::user::UserStatus::Online,
             joined_at: chrono::Utc::now(),
         };
         let json = serde_json::to_string(&member).unwrap();
         assert!(json.contains("\"username\":\"test\""));
         // UserRole serialization depends on how it's defined (SCREAMING_SNAKE_CASE vs default)
         // If it's default, it's "Member".
         assert!(json.contains("\"role\":\"MEMBER\"")); // Assuming recent change to CAPS
    }

    #[test]
    fn test_system_message_formatting() {
        assert_eq!(format_welcome_message("toto"), "🎉 **toto** a rejoint le serveur !");
        assert_eq!(format_goodbye_message("toto"), "👋 **toto** a quitté le serveur");
        assert_eq!(format_ban_message("toto"), "🔨 **toto** a été banni du serveur");
    }
}
