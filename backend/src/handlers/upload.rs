use axum::{
    extract::Multipart,
    Json,
    response::{IntoResponse, Response},
    http::StatusCode,
};
use serde_json::json;
use std::path::Path;
use uuid::Uuid;
use tokio::fs;
// use tokio::io::AsyncWriteExt; // Commented out unused import

pub async fn upload_file(mut multipart: Multipart) -> Response {
    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        
        if name == "file" {
            let file_name = field.file_name().unwrap_or("file").to_string();
            let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
            
            if !content_type.starts_with("image/") {
                 return (StatusCode::BAD_REQUEST, Json(json!({ "error": "Only images are allowed" }))).into_response();
            }

            let ext = Path::new(&file_name).extension().and_then(|s| s.to_str()).unwrap_or("png");
            let new_filename = format!("{}.{}", Uuid::new_v4(), ext);
            let filepath = format!("./uploads/{}", new_filename);

            let data = match field.bytes().await {
                Ok(data) => data,
                Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
            };

            if let Err(e) = fs::write(&filepath, data).await {
                 return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Failed to save file: {}", e) }))).into_response();
            }

            return Json(json!({ "url": format!("/uploads/{}", new_filename) })).into_response();
        }
    }

    (StatusCode::BAD_REQUEST, Json(json!({ "error": "No file field found" }))).into_response()
}
