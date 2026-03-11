use axum::{
    routing::{get, post, put, delete},
    Router,
    middleware,
};
use std::sync::Arc;

use crate::{
    handlers::server::{
        create_server, get_my_servers, get_server, update_server, delete_server,
        join_server, remove_member, update_member_role, ban_user, get_server_members,
    },
    middleware::auth::auth_middleware,
    AppState,
};

pub fn server_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(create_server))
        .route("/", get(get_my_servers))
        .route("/join", post(join_server))
        .route("/{id}", get(get_server))
        .route("/{id}", put(update_server))
        .route("/{id}", delete(delete_server))
        .route("/{id}/members", get(get_server_members))
        .route("/{id}/members/{user_id}", delete(remove_member))
        .route("/{id}/members/{user_id}/role", axum::routing::patch(update_member_role))
        .route("/{id}/ban", post(ban_user))
        .route("/{id}/bans", get(crate::handlers::server::get_server_bans))
        .route("/{id}/unban", post(crate::handlers::server::unban_user))
        .route_layer(middleware::from_fn_with_state(state, auth_middleware))
}
