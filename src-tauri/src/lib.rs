use std::fs;
use tauri::Manager;

#[tauri::command]
fn write_sidecar_request(command: String, task_id: String, contents: String) -> Result<String, String> {
    if !is_safe_request_segment(&command) {
        return Err("Invalid sidecar command name.".to_string());
    }
    if !is_safe_request_segment(&task_id) {
        return Err("Invalid sidecar task id.".to_string());
    }

    let request_dir = std::env::temp_dir()
        .join("raw-pair-cleaner-lite")
        .join("sidecar-requests");
    fs::create_dir_all(&request_dir).map_err(|error| error.to_string())?;

    let request_path = request_dir.join(format!("{task_id}-{command}.json"));
    fs::write(&request_path, contents).map_err(|error| error.to_string())?;

    request_path
        .to_str()
        .map(|path| path.to_string())
        .ok_or_else(|| "Sidecar request path is not valid UTF-8.".to_string())
}

#[tauri::command]
fn get_sidecar_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("sidecar");
    fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;

    data_dir
        .to_str()
        .map(|path| path.to_string())
        .ok_or_else(|| "Sidecar data path is not valid UTF-8.".to_string())
}

fn is_safe_request_segment(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![write_sidecar_request, get_sidecar_data_dir])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::is_safe_request_segment;

    #[test]
    fn safe_request_segment_accepts_known_command_names() {
        assert!(is_safe_request_segment("scan"));
        assert!(is_safe_request_segment("settings-save"));
    }

    #[test]
    fn safe_request_segment_rejects_path_like_values() {
        assert!(!is_safe_request_segment("../scan"));
        assert!(!is_safe_request_segment("scan/request"));
        assert!(!is_safe_request_segment(""));
    }
}
