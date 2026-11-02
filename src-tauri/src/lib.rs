use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Component, Path};
use std::process::{Child, Stdio};
use std::sync::Mutex;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_fs::FsExt;

/// Grant the webview fs and asset-protocol access to `path` (recursively). Nothing else is allowed.
// shortcut: workspaces opened earlier in the session stay allowed until restart; revoke on switch if that matters.
#[tauri::command]
fn allow_workspace<R: tauri::Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    if !Path::new(&path).is_dir() {
        return Err(format!("{path} is not a folder"));
    }
    app.fs_scope().allow_directory(&path, true).map_err(|e| e.to_string())?;
    app.fs_scope().allow_file(Path::new(&path).join(".synapse.json")).map_err(|e| e.to_string())?;
    app.asset_protocol_scope().allow_directory(&path, true).map_err(|e| e.to_string())
}

/// Send `<root>/<rel>` to the OS trash. `rel` must stay inside `root` (no `..`, no absolute paths),
/// and `root` must be an allowed workspace.
#[tauri::command]
fn move_to_trash(app: AppHandle, root: String, rel: String) -> Result<(), String> {
    trash_inside(&app, &root, &rel)
}

fn trash_inside(app: &AppHandle, root: &str, rel: &str) -> Result<(), String> {
    let rel = Path::new(&rel);
    if rel.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err("path must be relative to the workspace".into());
    }
    let full = Path::new(root).join(rel);
    if !app.fs_scope().is_allowed(&full) {
        return Err("path is outside the workspace".into());
    }
    let inside = full.canonicalize().map_err(|e| e.to_string())?.starts_with(
        Path::new(root).canonicalize().map_err(|e| e.to_string())?,
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
    // explorer ignores forward-slash paths and opens Documents instead
    let path = if cfg!(windows) { path.replace('/', "\\") } else { path };
    std::process::Command::new(opener).arg(&path).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// Calls `emit(rel_path, content)` for every `.md` under `dir`. Dot-entries are always skipped;
/// a `skip` entry without `/` matches that name anywhere, one with `/` matches that path from the root.
/// `.gitignore` is not read: notes often live in gitignored folders on purpose.
fn walk_md(dir: &Path, rel: &str, skip: &[String], emit: &mut impl FnMut(String, String)) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for e in entries.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        let path = if rel.is_empty() { name.clone() } else { format!("{rel}/{name}") };
        if name.starts_with('.') || skip.iter().any(|s| *s == name || *s == path) {
            continue;
        }
        let Ok(kind) = e.file_type() else { continue };
        if kind.is_dir() {
            walk_md(&e.path(), &path, skip, emit);
        } else if kind.is_file() && name.to_lowercase().ends_with(".md") {
            if let Ok(content) = std::fs::read_to_string(e.path()) {
                emit(path, content);
            }
        }
    }
}

/// Stream every `.md` file of an allowed workspace to `on_batch` (about every 100 ms or 500 files).
/// Resolves with the number of files sent, so the caller knows when the channel has drained.
#[tauri::command]
async fn index_workspace(app: AppHandle, root: String, skip: Vec<String>, on_batch: Channel<Vec<(String, String)>>) -> Result<usize, String> {
    if !app.fs_scope().is_allowed(&root) {
        return Err("path is outside the workspace".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let (mut batch, mut total, mut last) = (Vec::new(), 0, std::time::Instant::now());
        let mut failed = None;
        walk_md(Path::new(&root), "", &skip, &mut |p, c| {
            batch.push((p, c));
            total += 1;
            if batch.len() >= 500 || last.elapsed() >= std::time::Duration::from_millis(100) {
                failed = failed.take().or(on_batch.send(std::mem::take(&mut batch)).err());
                last = std::time::Instant::now();
            }
        });
        if !batch.is_empty() {
            failed = failed.or(on_batch.send(batch).err());
        }
        failed.map_or(Ok(total), |e| Err(e.to_string()))
    })
    .await
    .map_err(|e| e.to_string())?
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

/// Unified diff of one workspace-relative `path` against HEAD; untracked files (or any file before
/// the first commit) diff as fully added.
#[tauri::command]
fn git_diff(app: AppHandle, root: String, path: String) -> Result<String, String> {
    if !app.fs_scope().is_allowed(&root) {
        return Err("path is outside the workspace".into());
    }
    // --no-index reads any file, so keep `path` inside the workspace
    if Path::new(&path).components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err("path must be relative to the workspace".into());
    }
    let ok = |args: &[&str]| git(&root, args).map(|o| o.status.success()).unwrap_or(false);
    let args: Vec<&str> = if ok(&["rev-parse", "--verify", "-q", "HEAD"])
        && ok(&["--literal-pathspecs", "ls-files", "--error-unmatch", "--", &path])
    {
        vec!["--literal-pathspecs", "diff", "HEAD", "--", &path]
    } else {
        vec!["--literal-pathspecs", "diff", "--no-index", "--", "/dev/null", &path]
    };
    let o = git(&root, &args).map_err(|e| e.to_string())?;
    // --no-index exits 1 when the files differ
    if !o.status.success() && o.status.code() != Some(1) {
        return Err(String::from_utf8_lossy(&o.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&o.stdout).into_owned())
}

/// Throw away uncommitted changes to one workspace-relative `path`: back to HEAD when HEAD has it,
/// otherwise unstage it and send the file to the trash.
#[tauri::command]
fn git_discard(app: AppHandle, root: String, path: String) -> Result<(), String> {
    if !app.fs_scope().is_allowed(&root) {
        return Err("path is outside the workspace".into());
    }
    if Path::new(&path).components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err("path must be relative to the workspace".into());
    }
    let ok = |args: &[&str]| git(&root, args).map(|o| o.status.success()).unwrap_or(false);
    let in_head = ok(&["rev-parse", "--verify", "-q", "HEAD"]) && ok(&["cat-file", "-e", &format!("HEAD:./{path}")]);
    let args = if in_head {
        vec!["--literal-pathspecs", "restore", "--source=HEAD", "--staged", "--worktree", "--", &path]
    } else {
        vec!["--literal-pathspecs", "rm", "--cached", "-q", "--ignore-unmatch", "--", &path]
    };
    let o = git(&root, &args).map_err(|e| e.to_string())?;
    if !o.status.success() {
        return Err(String::from_utf8_lossy(&o.stderr).trim().to_string());
    }
    if !in_head && Path::new(&root).join(&path).exists() {
        trash_inside(&app, &root, &path)?;
    }
    Ok(())
}

/// The running `claude` child, if any (one chat run at a time).
#[derive(Default)]
struct Claude(Mutex<Option<Child>>);

/// Run the `claude` CLI headless in an allowed workspace, forwarding each stdout line (stream-json) through
/// `on_event`, then a final `{"type":"exit",...}` line. `Err("claude-not-found")` when it is not installed.
// shortcut: on Windows only claude.exe is found, not an npm claude.cmd; upgrade if users hit it.
#[tauri::command]
fn claude_run(
    app: AppHandle,
    state: State<Claude>,
    root: String,
    message: String,
    session_id: Option<String>,
    on_event: tauri::ipc::Channel<String>,
) -> Result<(), String> {
    if !app.fs_scope().is_allowed(&root) {
        return Err("path is outside the workspace".into());
    }
    let mut slot = state.0.lock().unwrap();
    if slot.is_some() {
        return Err("busy".into());
    }
    let mut cmd = std::process::Command::new("claude");
    cmd.current_dir(&root)
        .args(["-p", "--output-format", "stream-json", "--verbose", "--restricted", "--tools", "Read,Edit,Write,Glob,Grep"])
        .args(["--strict-mcp-config", "--permission-mode", "acceptEdits", "--permission-prompts", "none"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(id) = &session_id {
        cmd.args(["--resume", id]);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let mut child = cmd.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound { "claude-not-found".into() } else { e.to_string() }
    })?;
    // the message goes on stdin so quoting and a leading `-` can't matter
    let mut stdin = child.stdin.take().unwrap();
    let stdout = child.stdout.take().unwrap();
    let mut stderr = child.stderr.take().unwrap();
    *slot = Some(child);
    drop(slot);

    std::thread::spawn(move || {
        let _ = stdin.write_all(message.as_bytes()); // dropped → EOF
    });
    let err_thread = std::thread::spawn(move || {
        let mut buf = String::new();
        let _ = stderr.read_to_string(&mut buf);
        buf
    });
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let _ = on_event.send(line);
        }
        let stderr = err_thread.join().unwrap_or_default();
        let child = app.state::<Claude>().0.lock().unwrap().take();
        let code = child.and_then(|mut c| c.wait().ok()).and_then(|s| s.code());
        let _ = on_event.send(serde_json::json!({ "type": "exit", "code": code, "stderr": stderr }).to_string());
    });
    Ok(())
}

/// Kill the running chat; the reader thread then sends the `exit` event as usual.
#[tauri::command]
fn claude_stop(state: State<Claude>) {
    if let Some(c) = state.0.lock().unwrap().as_mut() {
        let _ = c.kill();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Claude::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![allow_workspace, move_to_trash, reveal_workspace, index_workspace, git_status, git_commit, git_diff, git_discard, claude_run, claude_stop])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workspace_scope_allows_config_but_not_unrelated_dotfiles() {
        let app = tauri::test::mock_builder()
            .plugin(tauri_plugin_fs::init())
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let root = Path::new(env!("CARGO_MANIFEST_DIR"));
        let config = root.join(".synapse.json");
        assert!(!app.fs_scope().is_allowed(&config));

        allow_workspace(app.handle().clone(), root.to_string_lossy().into_owned()).unwrap();

        assert!(app.fs_scope().is_allowed(root));
        assert!(app.fs_scope().is_allowed(root.join("docs/note.md")));
        assert!(app.fs_scope().is_allowed(&config));
        assert!(!app.fs_scope().is_allowed(root.parent().unwrap().join("outside.md")));
        #[cfg(unix)]
        assert!(!app.fs_scope().is_allowed(root.join(".private")));
    }

    #[test]
    fn walk_finds_gitignored_notes_and_honours_skip_entries() {
        let root = std::env::temp_dir().join(format!("synapse-walk-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        for (p, body) in [
            ("a.md", "root"),
            ("sub/b.MD", "sub"),
            ("ignored/c.md", "gitignored"),
            ("node_modules/d.md", "name skip"),
            (".hidden/e.md", "dot dir"),
            ("a/target/f.md", "path skip"),
            ("b/target/g.md", "kept"),
            ("sub/n.txt", "not markdown"),
        ] {
            let f = root.join(p);
            std::fs::create_dir_all(f.parent().unwrap()).unwrap();
            std::fs::write(f, body).unwrap();
        }
        std::fs::write(root.join(".gitignore"), "ignored/\n").unwrap();
        let found = |skip: &[&str]| {
            let skip: Vec<String> = skip.iter().map(|s| s.to_string()).collect();
            let mut out = Vec::new();
            walk_md(&root, "", &skip, &mut |p, _| out.push(p));
            out.sort();
            out
        };
        assert_eq!(found(&["node_modules", "a/target"]), ["a.md", "b/target/g.md", "ignored/c.md", "sub/b.MD"]);
        assert_eq!(found(&["target", "ignored"]), ["a.md", "node_modules/d.md", "sub/b.MD"]);
        std::fs::remove_dir_all(&root).unwrap();
    }
}
