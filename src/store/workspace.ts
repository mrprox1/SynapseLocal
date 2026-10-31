import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, readDir, rename, readTextFile, watch, writeTextFile, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { load } from "@tauri-apps/plugin-store";
import { parseMarkdown, resolveLink, rewriteLinks, type ParsedMarkdown } from "@/lib/markdown";
import { parseStatus, type GitStatus } from "@/lib/git";
import { slugify, uniquePath } from "@/lib/board";
import { setFrontmatterKey } from "@/lib/frontmatter";
import { categorize, DEFAULT_CONFIG, parseConfig, sanitizeName, type Category, type Config } from "@/lib/workspace";

export type FileEntry = ParsedMarkdown & { path: string; category: Category; content: string };

type State = {
  root: string | null;
  config: Config;
  files: Record<string, FileEntry>;
  /** Uncommitted changes; null when the workspace isn't in a git repo. */
  git: GitStatus | null;
  /** `git add -A` + commit just `paths` (workspace-relative); rejects with git's message. */
  commitAll: (message: string, paths: string[]) => Promise<void>;
  openFolder: () => Promise<void>;
  restoreLast: () => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  /** Write `<root>/.synapse.json` and re-index. */
  saveConfig: (config: Config) => Promise<void>;
  /** Create `<docsDir>/<name>.md` (`# name`) unless it exists; returns its path. */
  createDoc: (name: string) => Promise<string>;
  /** Create `<ticketsDir>/<slug>.md` with title and status; returns its path. */
  createTicket: (title: string, status: string) => Promise<string>;
  /** Create `path` (with parent folders) unless it exists; throws if it does. */
  createFile: (path: string, content?: string) => Promise<void>;
  /** Rename/move a file; refuses if the target exists. Returns the new path. */
  moveFile: (path: string, newPath: string) => Promise<string>;
  /** Send a file to the OS trash. */
  trashFile: (path: string) => Promise<void>;
  /**
   * Rename a doc in place. If other files link to it, `confirm(links, files)` decides
   * whether their `[[links]]` are rewritten. Returns the new path.
   */
  renameDoc: (path: string, name: string, confirm: (links: number, files: number) => Promise<boolean>) => Promise<string>;
};

let unwatch: UnwatchFn | null = null;
const norm = (p: string) => p.split("\\").join("/");
const SKIP =(name: string) => name.startsWith(".") || name === "node_modules";
const settings = () => load("settings.json");
/** Fs access is granted per workspace by the Rust side; must run before touching `dir`. */
const allowWorkspace = (dir: string) => invoke("allow_workspace", { path: dir });

async function walk(root: string, rel: string, out: string[]) {
  for (const e of await readDir(rel ? `${root}/${rel}` : root)) {
    if (SKIP(e.name)) continue;
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory) await walk(root, p, out);
    else if (e.isFile && /\.md$/i.test(e.name)) out.push(p);
  }
}

export const useWorkspace = create<State>((set, get) => {
  const entry = (path: string, content: string, config: Config): FileEntry => ({
    path,
    content,
    category: categorize(path, config),
    ...parseMarkdown(path, content),
  });

  async function index(root: string) {
    root = norm(root);
    const cfgPath = `${root}/.synapse.json`;
    const config = parseConfig((await exists(cfgPath)) ? await readTextFile(cfgPath) : null);
    const paths: string[] = [];
    await walk(root, "", paths);
    const prev = get().root === root ? get().files : {};
    const sameConfig = get().config === config || JSON.stringify(get().config) === JSON.stringify(config);
    const files: Record<string, FileEntry> = {};
    await Promise.all(
      paths.map(async (p) => {
        const content = await readTextFile(`${root}/${p}`);
        // keep the old entry when nothing changed so subscribers don't re-render
        const old = prev[p];
        files[p] = old && sameConfig && old.content === content ? old : entry(p, content, config);
      }),
    );
    set({ root, config, files });
    await refreshGit(root);
  }

  async function refreshGit(root: string) {
    try {
      const r = await invoke<[string, string] | null>("git_status", { root });
      if (get().root === root) set({ git: r && parseStatus(r[0], r[1]) });
    } catch (e) {
      console.warn(e);
      set({ git: null });
    }
  }

  async function startWatch(root: string) {
    await unwatch?.();
    unwatch = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    unwatch = await watch(
      root,
      (e) => {
        // ignore noise from .git / node_modules; everything else triggers a rescan
        const rel = e.paths.map((p) => norm(p).slice(root.length + 1));
        if (rel.every((p) => p.split("/").some((s) => s === ".git" || s === "node_modules"))) return;
        clearTimeout(timer);
        timer = setTimeout(() => index(root).catch(console.warn), 100);
      },
      { recursive: true, delayMs: 300 },
    );
  }

  return {
    root: null,
    config: DEFAULT_CONFIG,
    files: {},
    git: null,
    async commitAll(message, paths) {
      const root = get().root!;
      await invoke("git_commit", { root, message, paths });
      await refreshGit(root); // the watcher ignores .git
    },
    async openFolder() {
      const dir = await open({ directory: true });
      if (typeof dir !== "string") return;
      await allowWorkspace(dir);
      await index(dir);
      await startWatch(norm(dir));
      const s = await settings();
      await s.set("lastRoot", dir);
      await s.save();
    },
    async restoreLast() {
      const last = await (await settings()).get<string>("lastRoot");
      // rejects when the folder is gone
      if (last && (await allowWorkspace(last).then(() => true, () => false))) {
        await index(last);
        await startWatch(norm(last));
      }
    },
    async createDoc(name) {
      const { root, config, files } = get();
      const clean = sanitizeName(name);
      if (!clean) throw new Error("empty name");
      const path = `${config.docsDir}/${clean}.md`;
      // case-insensitive: on Windows `readme.md` would overwrite an existing `README.md`
      const hit = Object.keys(files).find((p) => p.toLowerCase() === path.toLowerCase());
      if (hit) return hit;
      await mkdir(`${root}/${config.docsDir}`, { recursive: true });
      await get().writeFile(path, `# ${clean}\n`);
      return path;
    },
    async createTicket(title, status) {
      const { root, config, files } = get();
      const t = title.trim();
      if (!t) throw new Error("empty title");
      const path = uniquePath(config.ticketsDir, slugify(t), Object.keys(files));
      await mkdir(`${root}/${config.ticketsDir}`, { recursive: true });
      await get().writeFile(path, setFrontmatterKey(setFrontmatterKey("", "title", t), "status", status));
      return path;
    },
    async renameDoc(path, name, confirm) {
      const { root, files, config } = get();
      const clean = sanitizeName(name);
      if (!clean) throw new Error("empty name");
      const newPath = `${path.split("/").slice(0, -1).concat(`${clean}.md`).join("/")}`;
      if (newPath === path) return path;
      if (Object.keys(files).some((p) => p.toLowerCase() === newPath.toLowerCase() && p !== path))
        throw new Error(`${newPath} already exists`);

      const targets = Object.values(files);
      const updates = Object.values(files).flatMap((f) => {
        if (f.path === path) return [];
        const r = rewriteLinks(f.content, (t) => resolveLink(t, targets)?.path === path, clean);
        return r.n ? [{ f, ...r }] : [];
      });
      const doUpdate =
        updates.length > 0 && (await confirm(updates.reduce((a, u) => a + u.n, 0), updates.length));

      const old = files[path];
      await rename(`${root}/${path}`, `${root}/${newPath}`);
      set((s) => {
        const { [path]: _, ...rest } = s.files;
        return { files: { ...rest, [newPath]: entry(newPath, old.content, config) } };
      });
      if (doUpdate) for (const u of updates) await get().writeFile(u.f.path, u.content);
      return newPath;
    },
    async createFile(path, content = "") {
      const { root, files } = get();
      if (Object.keys(files).some((p) => p.toLowerCase() === path.toLowerCase())) throw new Error(`${path} already exists`);
      await mkdir(`${root}/${path.split("/").slice(0, -1).join("/")}`, { recursive: true });
      await get().writeFile(path, content);
    },
    async moveFile(path, newPath) {
      const { root, files, config } = get();
      if (newPath === path) return path;
      if (Object.keys(files).some((p) => p.toLowerCase() === newPath.toLowerCase() && p !== path))
        throw new Error(`${newPath} already exists`);
      await mkdir(`${root}/${newPath.split("/").slice(0, -1).join("/")}`, { recursive: true });
      await rename(`${root}/${path}`, `${root}/${newPath}`);
      set((s) => {
        const { [path]: old, ...rest } = s.files;
        return { files: { ...rest, [newPath]: entry(newPath, old.content, config) } };
      });
      return newPath;
    },
    async trashFile(path) {
      await invoke("move_to_trash", { root: get().root, rel: path });
      set((s) => {
        const { [path]: _, ...rest } = s.files;
        return { files: rest };
      });
    },
    async saveConfig({ docsDir, ticketsDir }) {
      const root = get().root!;
      await writeTextFile(`${root}/.synapse.json`, JSON.stringify({ docsDir, ticketsDir }, null, 2) + "\n");
      await index(root); // don't wait for the watcher
    },
    async writeFile(path, content) {
      const { root, config } = get();
      await writeTextFile(`${root}/${path}`, content);
      set((s) => ({ files: { ...s.files, [path]: entry(path, content, config) } }));
    },
  };
});
