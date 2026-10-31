# SynapseLocal

A local-first desktop app for a folder of Markdown files. Open a project folder and get three views over the same `.md` files:

- **Docs**: a wiki for your docs folder, with `[[wiki links]]`, backlinks, a link graph and preview.
- **Board**: a Kanban board where each ticket is a Markdown file and its column is the `status` in its frontmatter.
- **Files**: a file tree and a plain editor for every other `.md` file, with a focus mode.

Everything stays as plain files on disk. There is no database or sync, and no account. Edits made in another editor or by `git pull` show up within about a second.

Built with Tauri 2, React, TypeScript and CodeMirror 6.

## Getting started

Prerequisites: [Node.js](https://nodejs.org/) and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) (Rust, plus WebView2 on Windows).

```sh
npm install
npm run tauri dev     # run the app
npm run tauri build   # build an installer
npm test              # unit tests (Vitest)
```

Click **Open folder** and pick a project folder. The app reopens the last folder on launch.

## How files are sorted

Every `.md` file in the folder falls into one of three groups, by its location:

| Location | Shown in |
|---|---|
| `docs/` | Docs view and graph |
| `tickets/` | Board |
| anywhere else | Files view |

The app skips `.git/`, `node_modules/` and dot-folders.

To use different folders, add `.synapse.json` to the project root:

```json
{ "docsDir": "wiki", "ticketsDir": "tasks" }
```

## Docs

- Type `[[` to get suggestions from existing docs. **Ctrl+click** a link to open it. A link to a missing doc is shown dashed, and Ctrl+clicking it creates the doc.
- A link `[[Name]]` matches a file by its name (ignoring case, without `.md`), and falls back to the doc's title. Use `[[Name|label]]` to show different text.
- **Ctrl+E** switches between the editor and the preview. The preview renders tables, task lists, `$math$`, code highlighting and images relative to the file.
- The backlinks panel lists every file that links to the open doc, with the line around the link.
- **Graph** shows all docs and the links between them. Click a node to open that doc.
- **Rename** renames the file and offers to update the links that point to it.

## Board

A ticket is a Markdown file in the tickets folder:

```markdown
---
title: Fix login bug
status: todo        # backlog | todo | in-progress | done
priority: high      # low | medium | high (optional)
assignee: me        # optional
---
Notes, sub-tasks (- [ ] ...) and [[Doc Links]].
```

- A ticket with a missing or unknown `status` goes in **Backlog**. The file isn't changed until you move the card.
- Drag a card to move it, or use the keyboard: **Space** picks a card up, the arrow keys move it and **Space** drops it. On drop, the app changes only the `status` and `order` lines. The rest of the file, including comments and key order, stays exactly as it was.
- Click a card, or press **Enter** on it, to edit its title, status, priority, assignee and body.
- **+** on a column creates a new ticket in that column. Use the filter bar to show tickets by priority or assignee.

## Files

- Use the buttons for a new file or new folder. Right-click a file to **Rename**, **Delete** (moves it to the OS trash), or **Move to Docs** / **Move to Tickets**.
- **Focus** hides the sidebars and keeps the text at a readable width. Press **Esc** to leave.

## Security

The app can only read and write inside the folder you open. Access is granted at runtime when you open or reopen a folder; there are no file permissions beyond that.

## Project layout

```
src/
  lib/          parsing, frontmatter edits, board and tree logic (unit-tested)
  store/        Zustand stores: workspace index and file I/O, UI state
  components/   shared Markdown editor and preview
  views/        docs/, board/, explorer/
src-tauri/      Rust shell: workspace access and trash commands
```

## License

[MIT](LICENSE)
