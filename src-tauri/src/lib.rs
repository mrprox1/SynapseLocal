use std::path::{Component, Path};

/// Send `<root>/<rel>` to the OS trash. `rel` must stay inside `root` (no `..`, no absolute paths).
#[tauri::command]
fn move_to_trash(root: String, rel: String) -> Result<(), String> {
    let rel = Path::new(&rel);
    if rel.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err("path must be relative to the workspace".into());
    }
    let full = Path::new(&root).join(rel);
    let inside = full.canonicalize().map_err(|e| e.to_string())?.starts_with(
        Path::new(&root).canonicalize().map_err(|e| e.to_string())?,
    );
    if !inside {
        return Err("path is outside the workspace".into());
    }
    trash::delete(full).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![move_to_trash])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
