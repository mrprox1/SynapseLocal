import { create } from "zustand";
import { open } from "@tauri-apps/plugin-dialog";
import { exists, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { load } from "@tauri-apps/plugin-store";
import { parseMarkdown, type ParsedMarkdown } from "@/lib/markdown";
import { categorize, DEFAULT_CONFIG, parseConfig, type Category, type Config } from "@/lib/workspace";

export type FileEntry = ParsedMarkdown & { path: string; category: Category; content: string };

type State = {
  root: string | null;
  config: Config;
  files: Record<string, FileEntry>;
  openFolder: () => Promise<void>;
  restoreLast: () => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
};

const SKIP = (name: string) => name.startsWith(".") || name === "node_modules";
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
    root = root.replace(/\\/g, "/");
    const cfgPath = `${root}/.synapse.json`;
    const config = parseConfig((await exists(cfgPath)) ? await readTextFile(cfgPath) : null);
    const paths: string[] = [];
    await walk(root, "", paths);
    const files: Record<string, FileEntry> = {};
    await Promise.all(
      paths.map(async (p) => {
        files[p] = entry(p, await readTextFile(`${root}/${p}`), config);
      }),
    );
    set({ root, config, files });
  }

  return {
    root: null,
    config: DEFAULT_CONFIG,
    files: {},
    async openFolder() {
      const dir = await open({ directory: true });
      if (typeof dir !== "string") return;
      await index(dir);
      const s = await settings();
      await s.set("lastRoot", dir);
      await s.save();
    },
    async restoreLast() {
      const last = await (await settings()).get<string>("lastRoot");
      if (last && (await exists(last))) await index(last);
    },
    async writeFile(path, content) {
      const { root, config } = get();
      await writeTextFile(`${root}/${path}`, content);
      set((s) => ({ files: { ...s.files, [path]: entry(path, content, config) } }));
    },
  };
});
