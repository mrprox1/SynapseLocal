import { create } from "zustand";
import { NO_FILTER, type Filter } from "@/lib/board";
import { useWorkspace } from "@/store/workspace";

export type View = "docs" | "board" | "files" | "git" | "settings";

type Ui = {
  view: View;
  current: string | null; // path of the file open in the editor
  focus: boolean; // Explorer focus mode
  sidebar: boolean; // sidebar expanded (Docs / Files)
  boardFilter: Filter; // session-only
  showArchived: boolean; // session-only
  recent: string[]; // opened paths, most recent first; session-only
  setBoardFilter: (f: Filter) => void;
  setView: (v: View) => void;
  /** Open a file, switching to the view that owns its category. */
  openPath: (path: string) => void;
};

export const useUi = create<Ui>((set) => ({
  view: "docs",
  current: null,
  focus: false,
  sidebar: true,
  boardFilter: NO_FILTER,
  showArchived: false,
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
