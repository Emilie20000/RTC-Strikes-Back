# RTC - Real Time Chat Application

## Description

RTC est une application de communication collaborative en temps reel. Elle permet aux utilisateurs de creer des espaces de discussion (serveurs) pour échanger des messages textuels et effectuer des appels vocaux. L'architecture est basee sur des services robustes garantissant performance et extensibilite.

## Fonctionnalités Detaillee

### Communication et Temps Reel
- Messagerie instantanee : Envoi et réception de messages via WebSockets (Socket.io).
- Indicateurs d'état : Visualisation en temps reel des utilisateurs en train d'ecrire (typing indicators).
- Gestion des messages : Possibilite d'editer ou de supprimer ses propres messages avec mise à jour immediate pour tous les clients.
- Pieces jointes : Support de l'upload de fichiers (images).

### Espaces et Canaux
- Serveurs : Espaces de travail ou communautaires isoles avec leurs propres membres et configurations.
- Canaux Textuels : Salons dedies aux discussions par thématiques.
- Canaux Vocaux : Support de la communication vocale utilisant WebRTC pour une latence minimale.
- Categories : Organisation des canaux pour une meilleure structure.

### Gestion de Communaute
- Invitations : Systeme de codes d'invitation uniques pour rejoindre des serveurs.
- Liste de membres : Affichage dynamique des membres d'un serveur avec leur statut de présence (En ligne, Inactif, Ne pas deranger, Hors ligne).
- Messages systeme : Notifications automatiques dans des salons dedies pour les arrivees, départs et bannissements.

### Securite et Moderation
- Authentification : Gestion des comptes via JWT (JSON Web Tokens) securises.
- Roles et Permissions : Systeme de droits (Proprietaire, Administrateur, Membre) controlant les actions sur le serveur et les canaux.
- Modération : Outils pour bannir et debannir des utilisateurs par les administrateurs.

## Architecture Technique

Le projet repose sur une pile technologique performante :

- Backend : Developpe en Rust avec le framework Axum pour une gestion efficace de la memoire.
- Frontend : Interface utilisateur developpee avec Next.js et Tailwind CSS.
- Base de donnees : Persistance des donnees assuree par PostgreSQL.
- Real-time : Moteur de communication bidirectionnelle Socket.io.
- VoIP : Protocoles WebRTC pour les flux audio.

## Installation et Deploiement

Le projet est integralement conteneurise avec Docker.

### Pre requis
- Docker
- Docker Compose

### Procedure de lancement
1. Construire les services : `docker-compose build`
2. Demarrer l'infrastructure : `docker-compose up -d`
3. Arreter les services : `docker-compose down`
4. Nettoyage complet (suppression des volumes) : `docker-compose down -v`

## Acces aux Services

- Application Web : http://localhost:3000
- API Backend : http://localhost:8080
- Interface de Gestion BDD (pgAdmin) : http://localhost:5050
  - Identifiant : Admin_snouwzrtc@snouwzrtc.com
  - Mot de passe : snouwzrtc

## Documentation Complementaire

- Documentation technique de l'API Backend : [backend/README.md](./backend/README.md)
