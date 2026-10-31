use std::path::{Component, Path};
use tauri::{AppHandle, Manager};
use tauri_plugin_fs::FsExt;

/// Grant the webview fs and asset-protocol access to `path` (recursively). Nothing else is allowed.
// shortcut: workspaces opened earlier in the session stay allowed until restart; revoke on switch if that matters.
#[tauri::command]
fn allow_workspace(app: AppHandle, path: String) -> Result<(), String> {
    if !Path::new(&path).is_dir() {
        return Err(format!("{path} is not a folder"));
    }
    app.fs_scope().allow_directory(&path, true).map_err(|e| e.to_string())?;
    app.asset_protocol_scope().allow_directory(&path, true).map_err(|e| e.to_string())
}

/// Send `<root>/<rel>` to the OS trash. `rel` must stay inside `root` (no `..`, no absolute paths),
/// and `root` must be an allowed workspace.
#[tauri::command]
fn move_to_trash(app: AppHandle, root: String, rel: String) -> Result<(), String> {
    let rel = Path::new(&rel);
    if rel.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err("path must be relative to the workspace".into());
    }
    let full = Path::new(&root).join(rel);
    if !app.fs_scope().is_allowed(&full) {
        return Err("path is outside the workspace".into());
    }
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
        .invoke_handler(tauri::generate_handler![allow_workspace, move_to_trash])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
