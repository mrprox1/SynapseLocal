import { create } from "zustand";

export type View = "docs" | "board" | "files";

export const useUi = create<{ view: View; setView: (v: View) => void }>((set) => ({
  view: "docs",
  setView: (view) => set({ view }),
}));
