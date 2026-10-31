import { create } from "zustand";
import { open } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, readDir, readTextFile, watch, writeTextFile, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { load } from "@tauri-apps/plugin-store";
import { parseMarkdown, type ParsedMarkdown } from "@/lib/markdown";
import { categorize, DEFAULT_CONFIG, parseConfig, sanitizeName, type Category, type Config } from "@/lib/workspace";

export type FileEntry = ParsedMarkdown & { path: string; category: Category; content: string };

type State = {
  root: string | null;
  config: Config;
  files: Record<string, FileEntry>;
  openFolder: () => Promise<void>;
  restoreLast: () => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  /** Create `<docsDir>/<name>.md` (`# name`) unless it exists; returns its path. */
  createDoc: (name: string) => Promise<string>;
};

let unwatch: UnwatchFn | null = null;
const norm = (p: string) => p.split("\\").join("/");
const SKIP =(name: string) => name.startsWith(".") || name === "node_modules";
const settings = () => load("settings.json");

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
    async openFolder() {
      const dir = await open({ directory: true });
      if (typeof dir !== "string") return;
      await index(dir);
      await startWatch(norm(dir));
      const s = await settings();
      await s.set("lastRoot", dir);
      await s.save();
    },
    async restoreLast() {
      const last = await (await settings()).get<string>("lastRoot");
      if (last && (await exists(last))) {
        await index(last);
        await startWatch(norm(last));
      }
    },
    async createDoc(name) {
      const { root, config, files } = get();
      const clean = sanitizeName(name);
      if (!clean) throw new Error("empty name");
      const path = `${config.docsDir}/${clean}.md`;
      if (!files[path]) {
        await mkdir(`${root}/${config.docsDir}`, { recursive: true });
        await get().writeFile(path, `# ${clean}\n`);
      }
      return path;
    },
    async writeFile(path, content) {
      const { root, config } = get();
      await writeTextFile(`${root}/${path}`, content);
      set((s) => ({ files: { ...s.files, [path]: entry(path, content, config) } }));
    },
  };
});
