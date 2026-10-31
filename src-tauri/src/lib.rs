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

/// Show an allowed workspace folder in the OS file manager.
#[tauri::command]
fn reveal_workspace(app: AppHandle, path: String) -> Result<(), String> {
    if !app.fs_scope().is_allowed(&path) {
        return Err("path is outside the workspace".into());
    }
    let opener = if cfg!(windows) { "explorer" } else if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
    std::process::Command::new(opener).arg(&path).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// Run `git <args>` in `root` without flashing a console window on Windows.
fn git(root: &str, args: &[&str]) -> std::io::Result<std::process::Output> {
    let mut cmd = std::process::Command::new("git");
    cmd.current_dir(root).args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd.output()
}

/// `[prefix, raw porcelain output]` for an allowed workspace, or `None` when it is not in a git repo
/// (or git is missing). Parsing happens in TS.
#[tauri::command]
fn git_status(app: AppHandle, root: String) -> Result<Option<(String, String)>, String> {
    if !app.fs_scope().is_allowed(&root) {
        return Err("path is outside the workspace".into());
    }
    let ok = |o: std::io::Result<std::process::Output>| o.ok().filter(|o| o.status.success());
    let Some(prefix) = ok(git(&root, &["rev-parse", "--show-prefix"])) else { return Ok(None) };
    let Some(status) = ok(git(&root, &["status", "--porcelain=v1", "-z", "--branch", "-uall", "--", "."])) else {
        return Ok(None);
    };
    Ok(Some((
        String::from_utf8_lossy(&prefix.stdout).trim().to_string(),
        String::from_utf8_lossy(&status.stdout).into_owned(),
    )))
}

/// Commit the given workspace-relative `paths` of an allowed workspace folder with `message`;
/// everything else stays uncommitted.
#[tauri::command]
fn git_commit(app: AppHandle, root: String, message: String, paths: Vec<String>) -> Result<(), String> {
    if !app.fs_scope().is_allowed(&root) {
        return Err("path is outside the workspace".into());
    }
    if paths.is_empty() {
        return Err("nothing selected".into());
    }
    for head in [vec!["add", "-A"], vec!["commit", "-m", &message]] {
        let mut args = vec!["--literal-pathspecs"];
        args.extend(head);
        args.push("--");
        args.extend(paths.iter().map(String::as_str));
        let o = git(&root, &args).map_err(|e| e.to_string())?;
        if !o.status.success() {
            let err = String::from_utf8_lossy(&o.stderr).trim().to_string();
            // "nothing to commit" goes to stdout
            return Err(if err.is_empty() { String::from_utf8_lossy(&o.stdout).trim().to_string() } else { err });
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![allow_workspace, move_to_trash, reveal_workspace, git_status, git_commit])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
