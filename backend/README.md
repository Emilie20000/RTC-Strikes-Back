# Documentation de l'API Backend

Ce document detaille les points de terminaison de l'API pour le projet RTC. Elle est developpee avec Rust et le framework Axum.

## Configuration de base

Base URL : http://localhost:8080

### Inscription
- Route : POST /api/auth/signup
- Corps : { "username": "...", "email": "...", "password": "..." }
- Reponse : 201 Created avec l'objet utilisateur et le token JWT.

### Connexion
- Route : POST /api/auth/login
- Corps : { "email": "...", "password": "..." }
- Reponse : 200 OK avec l'objet utilisateur et le token JWT.

### Deconnexion
- Route : POST /api/auth/logout
- Description : Invalide la session actuelle cote client.

### Profil actuel
- Route : GET /api/auth/me
- Authentification : Requise
- Reponse : 200 OK avec les informations de l'utilisateur connecte.

## Serveurs

Gestion des serveurs et de leurs membres.

### Liste des serveurs
- Route : GET /api/servers
- Authentification : Requise
- Reponse : 200 OK avec la liste des serveurs dont l'utilisateur est membre.

### Creer un serveur
- Route : POST /api/servers
- Authentification : Requise
- Corps : { "name": "...", "description": "..." }
- Reponse : 201 Created.

### Rejoindre un serveur
- Route : POST /api/servers/join
- Authentification : Requise
- Corps : { "invite_code": "..." }

### Details d'un serveur
- Route : GET /api/servers/{id}
- Authentification : Requise

### Membres d'un serveur
- Route : GET /api/servers/{id}/members
- Authentification : Requise

### Moderation
- Bannir : POST /api/servers/{id}/ban (Corps : { "user_id": "...", "reason": "..." })
- Debannir : POST /api/servers/{id}/unban
- Changer de role : PATCH /api/servers/{id}/members/{user_id}/role (Corps : { "role": "..." })

## Salons (Channels)

### Liste des salons d'un serveur
- Route : GET /api/channels/server/{server_id}
- Authentification : Requise

### Creer un salon
- Route : POST /api/channels
- Authentification : Requise
- Corps : { "server_id": "...", "name": "...", "type": "TEXT|VOICE" }

### Supprimer un salon
- Route : DELETE /api/channels/{id}
- Authentification : Requise

## Messages

### Recuperer les messages
- Route : GET /api/messages/channel/{channel_id}
- Authentification : Requise

### Modifier un message
- Route : PUT /api/messages/{id}
- Authentification : Requise

### Supprimer un message
- Route : DELETE /api/messages/{id}
- Authentification : Requise

## Utilisateurs

### Mettre a jour le statut
- Route : PATCH /api/users/me/status
- Corps : { "status": "ONLINE|IDLE|DND|OFFLINE" }

### Mettre a jour le profil
- Route : PATCH /api/users/me
- Corps : { "username": "...", "avatar_url": "..." }

## Fichiers

### Upload de fichier
- Route : POST /api/uploads
- Type : multipart/form-data
- Description : Permet d'envoyer des avatars ou des pieces jointes.

## Temps Reel (WebSockets)

Le backend utilise Socket.io pour les communications bidirectionnelles.

### Gestion des Salons (Rooms)

Les clients doivent rejoindre des salons pour recevoir des mises a jour.
- join : Rejoint un salon (ex: "server:{id}", "{channel_id}", "user:{id}").
- leave : Quitte un salon.

### Messagerie

#### Evenements Entrants (Client -> Serveur)
- send_message : Envoie un message dans un salon.
  Corps : { "channelId": "...", "author": "...", "content": "..." }
- typing : Indique que l'utilisateur commence a ecrire.
  Corps : { "channelId": "...", "author": "..." }
- stop_typing : Indique que l'utilisateur a arrete d'ecrire.
  Corps : { "channelId": "...", "author": "..." }

#### Evenements Sortants (Serveur -> Client)
- message : Recoit un nouveau message (objet ChatMessage).
- message_updated : Notification de modification d'un message.
- message_deleted : Notification de suppression d'un message.
- typing / stop_typing : Relais des indicateurs d'ecriture aux autres membres du salon.

### Vocaux et WebRTC

#### Gestion de l'etat vocal
- join_voice : Rejoint un salon vocal. (Corps : { "channelId": "...", "userId": "...", "serverId": "..." })
- leave_voice : Quitte un salon vocal.
- voice_mute : Change l'etat de sourdine. (Corps : { "userId": "...", "muted": boolean })

#### Signalisation WebRTC (Relais)
- offer : Envoie une offre WebRTC a un utilisateur cible.
- answer : Envoie une reponse WebRTC a l'initiateur.
- ice_candidate : Envoie un candidat ICE au pair.
Corps commun : { "targetUserId": "...", "signal": ..., "senderId": "..." }

#### Notifications Sortantes
- voice_states : Liste initiale des etats vocaux lors de la connexion a un salon de serveur.
- voice_state_update : Mise a jour de l'etat d'un utilisateur (joint, mute, etc.).
- voice_user_left : Notification qu'un utilisateur a quitte le vocal.

### Mises a jour Globales

Diffusions automatiques lors d'actions via l'API REST.
- channel_created : Nouveau salon cree sur le serveur.
- channel_deleted : Salon supprime du serveur.
- server_member_removed : Utilisateur retire du serveur (envoye au salon prive de l'utilisateur).
- user_status_changed : Changement de statut (ONLINE, IDLE, etc.).
- user_updated : Mise a jour du profil d'un utilisateur.
