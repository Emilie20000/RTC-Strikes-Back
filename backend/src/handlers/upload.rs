use axum::{
    extract::Multipart,
    Json,
    response::{IntoResponse, Response},
    http::StatusCode,
};
use serde_json::json;
use std::io::Cursor;
use std::time::{SystemTime, UNIX_EPOCH};
use sha1::{Sha1, Digest};
use std::env;

pub async fn upload_file(mut multipart: Multipart) -> Response {
    let cloud_name = env::var("CLOUDINARY_CLOUD_NAME").unwrap_or_default();
    let api_key = env::var("CLOUDINARY_API_KEY").unwrap_or_default();
    let api_secret = env::var("CLOUDINARY_API_SECRET").unwrap_or_default();

    if cloud_name.is_empty() || api_key.is_empty() || api_secret.is_empty() {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": "Cloudinary configuration missing" }))).into_response();
    }

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        
        if name == "file" {
            let content_type = field.content_type().unwrap_or("").to_string();
            
            if !content_type.starts_with("image/") && !content_type.is_empty() {
                 return (StatusCode::BAD_REQUEST, Json(json!({ "error": "Only images are allowed" }))).into_response();
            }

            let data = match field.bytes().await {
                Ok(data) => data,
                Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
            };

            // 1. Compress Image
            let img = match image::load_from_memory(&data) {
                Ok(img) => img,
                Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("Invalid image data: {}", e) }))).into_response(),
            };

            // Resize to max 800x800 while maintaining aspect ratio
            let scaled = img.resize(800, 800, image::imageops::FilterType::Lanczos3);
            
            let mut compressed_data = Vec::new();
            if let Err(e) = scaled.write_to(&mut Cursor::new(&mut compressed_data), image::ImageFormat::Jpeg) {
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Failed to compress image: {}", e) }))).into_response();
            }

            // 2. Prepare Cloudinary Upload
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();

            // Signature must include sorted parameters + API Secret
            let signature_str = format!("timestamp={}{}", timestamp, api_secret);
            let mut hasher = Sha1::new();
            hasher.update(signature_str.as_bytes());
            let signature = hex::encode(hasher.finalize());

            let client = reqwest::Client::new();
            let url = format!("https://api.cloudinary.com/v1_1/{}/image/upload", cloud_name);

            let form = reqwest::multipart::Form::new()
                .text("api_key", api_key.clone())
                .text("timestamp", timestamp.to_string())
                .text("signature", signature)
                .part("file", reqwest::multipart::Part::bytes(compressed_data)
                    .file_name("upload.jpg")
                    .mime_str("image/jpeg").unwrap());

            match client.post(&url).multipart(form).send().await {
                Ok(resp) => {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_default();
                    
                    if status.is_success() {
                        let json: serde_json::Value = serde_json::from_str(&body).unwrap_or(json!({}));
                        if let Some(secure_url) = json.get("secure_url").and_then(|v| v.as_str()) {
                            return Json(json!({ "url": secure_url })).into_response();
                        }
                    }
                    
                    return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Cloudinary error: {}", body) }))).into_response()
                }
                Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Upload failed: {}", e) }))).into_response(),
            }
        }
    }

    (StatusCode::BAD_REQUEST, Json(json!({ "error": "No file field found" }))).into_response()
}
