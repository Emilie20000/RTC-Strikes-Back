use axum::{
    routing::{get, post},
    Router, middleware,
};
use std::sync::Arc;

use crate::{
    handlers::auth::{signup, login, get_me, logout},
    middleware::auth::auth_middleware,
    AppState,
};

pub fn auth_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/signup", post(signup))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/me", get(get_me).route_layer(middleware::from_fn_with_state(state.clone(), auth_middleware)))
}
