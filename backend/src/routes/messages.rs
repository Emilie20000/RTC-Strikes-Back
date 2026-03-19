use axum::{
    Router, routing::{get, delete, post},
};
use std::sync::Arc;
use crate::AppState;
use crate::handlers::messages::{get_messages, delete_message, update_message, add_reaction_handler};
use crate::middleware::auth::auth_middleware;
use axum::middleware;

pub fn message_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/channel/{channel_id}", get(get_messages))
        .route("/{id}", delete(delete_message).put(update_message))
        .route("/reaction", post(add_reaction_handler))
        .route_layer(middleware::from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state)
}
