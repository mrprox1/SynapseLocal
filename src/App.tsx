import { useEffect } from "react";
import {
  FileText,
  GitBranch,
  FolderInput,
  FolderOpen,
  KanbanSquare,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUi, type View } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { cn } from "@/lib/utils";
import { Board } from "@/views/board/Board";
import { DocsMain, DocsSidebar } from "@/views/docs/DocsView";
import { ExplorerMain } from "@/views/explorer/ExplorerMain";
import { FileTree } from "@/views/explorer/FileTree";
import { SourceControl } from "@/views/git/SourceControl";
import { SettingsView } from "@/views/settings/SettingsView";
import { setThemeMode, useThemeMode, type ThemeMode } from "@/theme";

// click cycles through these
const THEMES: Record<ThemeMode, { next: ThemeMode; label: string; Icon: LucideIcon }> = {
  system: { next: "dark", label: "Theme: System", Icon: Monitor },
  dark: { next: "light", label: "Theme: Dark", Icon: Moon },
  light: { next: "system", label: "Theme: Light", Icon: Sun },
};

const VIEWS: { id: View; label: string; Icon: LucideIcon }[] = [
  { id: "docs", label: "Docs", Icon: FileText },
  { id: "board", label: "Board", Icon: KanbanSquare },
  { id: "files", label: "Files", Icon: FolderOpen },
  { id: "git", label: "Source Control", Icon: GitBranch },
];

export default function App() {
  const { root, files, openFolder, restoreLast } = useWorkspace();
  const { view, setView, sidebar } = useUi();
  const focus = useUi((s) => s.focus) && view === "files"; // only the Explorer has an exit for it
  const hasSidebar = view !== "board" && view !== "settings"; // these have nothing to list
  const changes = useWorkspace((s) => (s.git ? Object.keys(s.git.files).length : null)); // null = not a repo
  const open = () => openFolder().catch(console.error);
  const T = THEMES[useThemeMode()];
  useEffect(() => {
    if (changes === null && view === "git") setView("docs");
  }, [changes, view, setView]);
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
          onClick={() => setThemeMode(T.next)}
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
        {view === "files" && <FileTree />}
        {view === "git" && <SourceControl />}
      </aside>}
      <main className="flex min-w-0 flex-1 flex-col">
        {view === "settings" ? (
          <SettingsView />
        ) : !root ? (
          <div className="flex flex-1 items-center justify-center">
            <Button onClick={open}>Open folder</Button>
          </div>
        ) : view === "docs" ? (
          <DocsMain />
        ) : view === "board" ? (
          <Board />
        ) : (
          <ExplorerMain />
        )}
      </main>
    </div>
  );
}
