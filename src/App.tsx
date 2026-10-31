import { lazy, Suspense, useEffect } from "react";
import {
  FileText,
  GitBranch,
  FolderInput,
  FolderOpen,
  KanbanSquare,
  MessageSquare,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { CommandPalette } from "@/components/CommandPalette";
import { SearchDialog } from "@/components/SearchDialog";
import { Button } from "@/components/ui/button";
import { useUi, type View } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { cn } from "@/lib/utils";
import { Board } from "@/views/board/Board";
import { DocsMain, DocsSidebar } from "@/views/docs/DocsView";
import { NEXT_THEME, setThemeMode, useThemeMode, type ThemeMode } from "@/theme";

// Docs and Board are the core views and load eagerly; the rest load on first use
const ChatPanel = lazy(() => import("@/views/chat/ChatPanel").then((m) => ({ default: m.ChatPanel })));
const ExplorerMain = lazy(() => import("@/views/explorer/ExplorerMain").then((m) => ({ default: m.ExplorerMain })));
const FileTree = lazy(() => import("@/views/explorer/FileTree").then((m) => ({ default: m.FileTree })));
const DiffView = lazy(() => import("@/views/git/DiffView").then((m) => ({ default: m.DiffView })));
const SourceControl = lazy(() => import("@/views/git/SourceControl").then((m) => ({ default: m.SourceControl })));
const SettingsView = lazy(() => import("@/views/settings/SettingsView").then((m) => ({ default: m.SettingsView })));

// label + icon per mode; NEXT_THEME gives the click order
const THEMES: Record<ThemeMode, { label: string; Icon: LucideIcon }> = {
  system: { label: "Theme: System", Icon: Monitor },
  dark: { label: "Theme: Dark", Icon: Moon },
  light: { label: "Theme: Light", Icon: Sun },
};

const VIEWS: { id: View; label: string; Icon: LucideIcon }[] = [
  { id: "docs", label: "Docs", Icon: FileText },
  { id: "board", label: "Board", Icon: KanbanSquare },
  { id: "files", label: "Files", Icon: FolderOpen },
  { id: "git", label: "Source Control", Icon: GitBranch },
];

export default function App() {
  const { root, files, openFolder, restoreLast } = useWorkspace();
  const { view, setView, sidebar, chat } = useUi();
  const focus = useUi((s) => s.focus) && view === "files"; // only the Explorer has an exit for it
  const hasSidebar = view !== "board" && view !== "settings"; // these have nothing to list
  const changes = useWorkspace((s) => (s.git ? Object.keys(s.git.files).length : null)); // null = not a repo
  const open = () => openFolder().catch(console.error);
  const mode = useThemeMode();
  const T = THEMES[mode];
  useEffect(() => {
    if (changes === null && view === "git") setView("docs");
  }, [changes, view, setView]);
  useEffect(() => {
    // capture phase + preventDefault: overrides CodeMirror's select-line (Mod-l)
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault();
        useUi.setState((s) => ({ chat: !s.chat }));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  useEffect(() => {
    restoreLast().catch(console.warn);
  }, [restoreLast]);

  return (
    <div className="flex h-screen">
      {!focus && <nav className="flex w-14 flex-col items-center gap-2 border-r py-2">
        {VIEWS.filter((v) => v.id !== "git" || changes !== null).map(({ id, label, Icon }) => (
          <Button
            key={id}
            variant="ghost"
            size="icon"
            title={label}
            aria-label={label}
            className={cn("relative", view === id && "bg-accent")}
            onClick={() => setView(id)}
          >
            <Icon />
            {id === "git" && !!changes && (
              <span className="absolute -right-0.5 -bottom-0.5 min-w-4 rounded-full bg-blue-600 px-1 text-[10px] leading-4 text-white">
                {changes}
              </span>
            )}
          </Button>
        ))}
        <div className="flex-1" />
        {root && (
          <Button
            variant="ghost"
            size="icon"
            title="Claude chat (Ctrl+L)"
            aria-label="Claude chat"
            className={cn(chat && "bg-accent")}
            onClick={() => useUi.setState({ chat: !chat })}
          >
            <MessageSquare />
          </Button>
        )}
        {root && hasSidebar && (
          <Button
            variant="ghost"
            size="icon"
            title={sidebar ? "Hide sidebar" : "Show sidebar"}
            aria-label={sidebar ? "Hide sidebar" : "Show sidebar"}
            onClick={() => useUi.setState({ sidebar: !sidebar })}
          >
            {sidebar ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          title={T.label}
          aria-label={T.label}
          onClick={() => setThemeMode(NEXT_THEME[mode])}
        >
          <T.Icon />
        </Button>
        <Button variant="ghost" size="icon" title="Open folder…" aria-label="Open folder" onClick={open}>
          <FolderInput />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Settings"
          aria-label="Settings"
          className={cn(view === "settings" && "bg-accent")}
          onClick={() => setView("settings")}
        >
          <Settings />
        </Button>
      </nav>}
      {!focus && root && hasSidebar && sidebar && <aside className="flex min-h-0 w-64 flex-col gap-2 border-r p-3">
        <div className="min-w-0 text-xs text-muted-foreground" title={root}>
          <div className="truncate font-medium text-foreground">{root.split("/").pop()}</div>
          {Object.keys(files).length} files
        </div>
        {view === "docs" && <DocsSidebar />}
        <Suspense>
          {view === "files" && <FileTree />}
          {view === "git" && <SourceControl />}
        </Suspense>
      </aside>}
      <main className="flex min-w-0 flex-1 flex-col">
        <Suspense>
        {view === "settings" ? (
          <SettingsView key={root} /* fields reload when the workspace switches */ />
        ) : !root ? (
          <div className="flex flex-1 items-center justify-center">
            <Button onClick={open}>Open folder</Button>
          </div>
        ) : view === "docs" ? (
          <DocsMain />
        ) : view === "board" ? (
          <Board />
        ) : view === "git" ? (
          <DiffView />
        ) : (
          <ExplorerMain />
        )}
        </Suspense>
      </main>
      {!focus && root && chat && <Suspense><ChatPanel /></Suspense>}
      <CommandPalette />
      <SearchDialog />
    </div>
  );
}
