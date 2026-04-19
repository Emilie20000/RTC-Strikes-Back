use axum::{middleware, routing::get, Router};
use std::sync::Arc;

use crate::{handlers::trophee::get_user_trophees, middleware::auth::auth_middleware, AppState};

pub fn trophee_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/trophees", get(get_user_trophees))
        .route_layer(middleware::from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state)
}
