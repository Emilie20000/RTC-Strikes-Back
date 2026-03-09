use axum::{
    routing::{get, post, delete},
    Router, middleware,
};
use std::sync::Arc;

use crate::{
    handlers::channel::{create_channel, get_server_channels, delete_channel},
    middleware::auth::auth_middleware,
    AppState,
};

pub fn channel_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(create_channel))
        .route("/server/{server_id}", get(get_server_channels))
        .route("/{id}", delete(delete_channel))
        .route_layer(middleware::from_fn_with_state(state, auth_middleware))
}
