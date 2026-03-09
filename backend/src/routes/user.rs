use axum::{
    routing::{patch},
    Router,
    middleware,
};
use std::sync::Arc;

use crate::handlers::user;

pub fn user_routes(state: Arc<crate::AppState>) -> Router<Arc<crate::AppState>> {
    Router::new()
        .route("/me/status", patch(user::update_user_status))
        .route("/me", patch(user::update_user_profile))
        .layer(middleware::from_fn_with_state(state, crate::middleware::auth::auth_middleware))
}
