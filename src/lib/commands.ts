import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { NEXT_THEME, getThemeMode, setThemeMode } from "@/theme";

export type Prompt = { placeholder: string; submit: (text: string) => Promise<string> };
export type Command = {
  label: string;
  /** Returns a prompt when the command needs a name; the palette asks for it. */
  run: () => Prompt | void;
  when?: () => boolean;
};

const hasRoot = () => useWorkspace.getState().root !== null;
const go = (label: string, view: "docs" | "board" | "files" | "git" | "settings", when = hasRoot): Command => ({
  label: `Go to ${label}`,
  run: () => useUi.getState().setView(view),
  when,
});

export const COMMANDS: Command[] = [
  go("Docs", "docs"),
  go("Board", "board"),
  go("Files", "files"),
  go("Source Control", "git", () => useWorkspace.getState().git !== null),
  go("Settings", "settings", () => true),
  {
    label: "New doc",
    run: () => ({ placeholder: "Doc name…", submit: (n) => useWorkspace.getState().createDoc(n) }),
    when: hasRoot,
  },
  {
    label: "New ticket",
    run: () => ({
      placeholder: "Ticket title…",
      submit: (t) => useWorkspace.getState().createTicket(t, "backlog"),
    }),
    when: hasRoot,
  },
  { label: "Search in files", run: () => useUi.setState({ searchOpen: true }), when: hasRoot },
  { label: "Toggle theme", run: () => setThemeMode(NEXT_THEME[getThemeMode()]) },
  { label: "Open folder…", run: () => void useWorkspace.getState().openFolder().catch(console.error) },
  {
    label: "Toggle graph view",
    run: () => useUi.setState((s) => ({ graph: !s.graph })),
    when: () => hasRoot() && useUi.getState().view === "docs",
  },
  {
    label: "Toggle focus mode",
    run: () => useUi.setState((s) => ({ focus: !s.focus })),
    when: () => {
      const { view, current } = useUi.getState();
      return hasRoot() && view === "files" && !!current && useWorkspace.getState().files[current]?.category === "other";
    },
  },
];
