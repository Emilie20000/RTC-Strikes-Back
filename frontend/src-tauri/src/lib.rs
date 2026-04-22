// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn send_desktop_notification(title: String, body: String) {
    use std::process::Command;

    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("notify-send")
            .arg(&title)
            .arg(&body)
            .spawn();
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!("display notification \"{}\" with title \"{}\"", body, title);
        let _ = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .spawn();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            #[cfg(target_os = "linux")]
            {
                use webkit2gtk::PermissionRequestExt;
                use webkit2gtk::WebViewExt;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.with_webview(|webview| {
                        let webview = webview.inner();
                        webview.connect_permission_request(|_, request| {
                            use glib::Cast;
                            if let Some(_req) = request.downcast_ref::<webkit2gtk::UserMediaPermissionRequest>() {
                                request.allow();
                                return true;
                            }
                            if let Some(_req) = request.downcast_ref::<webkit2gtk::NotificationPermissionRequest>() {
                                request.allow();
                                return true;
                            }
                            false
                        });
                    });
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, send_desktop_notification])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
