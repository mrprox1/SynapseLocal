import { create } from "zustand";
import { NO_FILTER, type Filter } from "@/lib/board";
import { useWorkspace } from "@/store/workspace";

export type View = "docs" | "board" | "files" | "git" | "settings";

type Ui = {
  view: View;
  current: string | null; // path of the file open in the editor
  selected: string | null; // change shown in the Source Control diff; session-only
  focus: boolean; // Explorer focus mode
  graph: boolean; // Docs graph view; session-only
  sidebar: boolean; // sidebar expanded (Docs / Files)
  chat: boolean; // Claude chat panel; session-only
  boardFilter: Filter; // session-only
  showArchived: boolean; // session-only
  jump: { path: string; from: number; to: number } | null; // select this range once the file is open; session-only
  searchOpen: boolean; // full-text search modal
  recent: string[]; // opened paths, most recent first; session-only
  setBoardFilter: (f: Filter) => void;
  setView: (v: View) => void;
  /** Open a file, switching to the view that owns its category. */
  openPath: (path: string) => void;
};

export const useUi = create<Ui>((set) => ({
  view: "docs",
  current: null,
  selected: null,
  focus: false,
  graph: false,
  sidebar: true,
  chat: false,
  boardFilter: NO_FILTER,
  showArchived: false,
  jump: null,
  searchOpen: false,
  recent: [],
  setBoardFilter: (boardFilter) => set({ boardFilter }),
  setView: (view) => set({ view }),
  openPath: (path) => {
    const cat = useWorkspace.getState().files[path]?.category;
    set((s) => ({
      current: path,
      view: cat === "ticket" ? "board" : cat === "other" ? "files" : "docs",
      recent: [path, ...s.recent.filter((p) => p !== path)].slice(0, 20),
    }));
  },
}));
