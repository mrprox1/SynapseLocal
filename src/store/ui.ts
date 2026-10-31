import { create } from "zustand";
import { useWorkspace } from "@/store/workspace";

export type View = "docs" | "board" | "files";

type Ui = {
  view: View;
  current: string | null; // path of the file open in the editor
  setView: (v: View) => void;
  /** Open a file, switching to the view that owns its category. */
  openPath: (path: string) => void;
};

export const useUi = create<Ui>((set) => ({
  view: "docs",
  current: null,
  setView: (view) => set({ view }),
  openPath: (path) => {
    const cat = useWorkspace.getState().files[path]?.category;
    set({ current: path, view: cat === "ticket" ? "board" : cat === "other" ? "files" : "docs" });
  },
}));
