# SynapseLocal

A local-first desktop app for the markdown files in a project folder: a linked knowledge base, a Kanban board, and a plain file explorer, all working on the same `.md` files on disk. Built with Tauri v2, React and TypeScript.

Nothing is stored in a database. Every view reads and writes ordinary markdown files, so the folder works just as well in VS Code, git or any other editor. Edits made outside the app show up within about a second.

## Features

### Workspace
- Open any folder. The last one opened is reopened on launch.
- Every `.md` file is sorted into one of three groups:
  - **Docs**: files under the docs folder (default `docs/`)
  - **Tickets**: files under the tickets folder (default `tickets/`)
  - **Other**: everything else
- `.git/`, `node_modules/` and dot-folders are skipped.
- Live reload: a file watcher re-indexes when files change on disk.
- A shared CodeMirror 6 editor. It saves 500 ms after you stop typing and when it loses focus, and keeps the file's formatting and line endings (CRLF stays CRLF).
- Light, dark or system theme.

### Docs and knowledge base
- Doc tree with new, rename and delete.
- `[[Wiki links]]` and `[[Target|alias]]`. Typing `[[` autocompletes doc and ticket names. Ctrl/Cmd+click opens the target, or creates it if it doesn't exist yet.
- Preview toggle (Ctrl/Cmd+E): GitHub-flavoured markdown (tables, task lists), `$math$` via KaTeX, syntax highlighting, and images resolved relative to the file.
- Backlinks panel: every file that links to the current doc, with the surrounding line.
- Graph view: docs as nodes, links as edges. Click a node to open the doc.
- Renaming a doc can update `[[Old Name]]` links in every other file (you confirm first).

### Task board (Kanban)
- Each ticket file is a card. The frontmatter `status` picks the column:

  ```markdown
  ---
  title: Fix login bug
  status: todo          # backlog | todo | in-progress | done
  priority: high        # low | medium | high (optional)
  assignee: me          # optional
  ---
  Notes, sub-tasks (- [ ] ...), [[Doc Links]].
  ```

  A missing or unknown status puts the card in **Backlog**.
- Tickets in subfolders appear on the same board as tickets directly in the tickets folder. Archive and restore preserve their relative subfolder paths.
- Headers support YAML frontmatter or an H1 followed by a `Field | Details` Markdown table. Ticket IDs are optional, arbitrary text (no required prefix). Both layouts support `id`, `summary`, `type`, `component`, `owner`, `reviewer`, `priority`, `tshirt_size`, `linked_documents` (a YAML list or comma-separated table values), and `compliance_driver`. Table labels use readable names such as **Ticket ID**, **T-shirt Size**, and **Linked Documents**. The older **Linked ISMS Documents** label is also accepted.
- YAML values take precedence when both layouts are present. Owner is used as the board assignee unless an explicit assignee is set. Linked documents participate in backlinks and the graph.
- Drag and drop between and within columns, mouse or keyboard. A drop changes only the `status` (and `order`) lines in the file. Other keys and comments stay exactly as they were.
- Cards show priority, assignee and sub-task progress (`2/5`).
- Ticket modal: edit title, status, priority, assignee, due date, and all header fields separately from the body. Linked documents are also shown as clickable links. Table field edits keep the table layout; fields without an existing row are saved in YAML.
- A "+" button on each column creates a new ticket. A filter bar narrows cards by priority and assignee.
- **Archive**: Done tickets can be archived one at a time, or all at once with "Archive all" (it respects the active filter). Archiving moves the file to `<ticketsDir>/archive/` without changing its content. Links to it keep working, and archived links show as `Archive: <name>`. "Show archived" displays them dimmed, with a **Restore** button.

### Files (explorer)
- A tree of all **Other** markdown files, with new file, new folder, rename and delete. Delete sends the file to the OS trash.
- "Move to Docs" / "Move to Tickets" to promote a scratch note.
- Focus mode: hides the sidebar and centres the text. Esc leaves it.

### Source control (git)
Only shown when the workspace is inside a git repo and `git` is on PATH.
- Changed files are coloured in the trees with `M` / `A` / `U` / `D`, VS Code style.
- A Source Control view with a change-count badge, a commit message box and a list of changes with checkboxes to choose which files go into the commit. Ctrl/Cmd+Enter commits.
- Click a changed `.md` file to see its unified diff.
- In a subfolder workspace, only files under that folder are committed.

### Command palette and search
- **Ctrl/Cmd+P**: fuzzy-jump to any doc, ticket or file. With an empty query, recently opened files come first.
- **Ctrl/Cmd+Shift+P** (or type `>`): commands. Go to a view, new doc or ticket, toggle theme, open folder, toggle graph or focus mode, search in files.
- **Ctrl/Cmd+Shift+F**: full-text search across all files, frontmatter included. All words must match, and `"quoted phrases"` match exactly. Scope chips: All / Docs / Tickets / Files. Opening a result scrolls the editor to the matching line.

### Claude Code chat
- **Ctrl/Cmd+L** opens a chat panel that runs your installed [Claude Code](https://docs.claude.com/en/docs/claude-code) CLI in headless mode, inside the workspace folder.
- Claude can read and edit workspace files, and its edits show up live. It is limited to the file tools (Read, Edit, Write, Glob, Grep): no Bash, no web, no MCP servers. Edits are accepted automatically, so use git to undo them.
- Tool calls appear as collapsible lines, and file paths in them are clickable. A "current file" chip tells Claude which file you're looking at.
- Follow-up messages continue the same conversation. **New chat** starts over, and **Stop** cancels a run.
- Login, model and billing come from your own Claude Code setup. The app stores no API keys.

### Settings
- Copy either a YAML or Markdown-table ticket header template, with matching metadata fields and a Linked Documents list.
- Change the docs and tickets folders (saved to `.synapse.json` in the workspace, so the setting travels with the project). Nested folders are allowed, e.g. `docs/tasks`, and the deeper folder wins.
- Theme: System / Light / Dark.
- Shows the workspace path, with "Reveal in Explorer".

## Configuration

Optional `.synapse.json` in the workspace root (it can also be edited from Settings):

```json
{ "docsDir": "docs", "ticketsDir": "tickets" }
```

## Development

Prerequisites: [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/), and the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS. Optional: `git` (source control) and `claude` (chat) on PATH.

```bash
npm install
npm run tauri dev     # run the app
npm test              # unit tests (vitest)
npm run tauri build   # build an installer
```

The app is developed and tested on Windows. macOS support is planned (`docs/plans/11-macos.md`).

