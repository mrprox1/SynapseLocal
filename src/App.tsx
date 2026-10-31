import { useEffect } from "react";
import { FileText, FolderOpen, KanbanSquare, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUi, type View } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { cn } from "@/lib/utils";
import { Board } from "@/views/board/Board";
import { DocsMain, DocsSidebar } from "@/views/docs/DocsView";
import { ExplorerMain } from "@/views/explorer/ExplorerMain";
import { FileTree } from "@/views/explorer/FileTree";

const VIEWS: { id: View; label: string; Icon: LucideIcon }[] = [
  { id: "docs", label: "Docs", Icon: FileText },
  { id: "board", label: "Board", Icon: KanbanSquare },
  { id: "files", label: "Files", Icon: FolderOpen },
];

export default function App() {
  const { root, files, openFolder, restoreLast } = useWorkspace();
  const { view, setView } = useUi();
  const focus = useUi((s) => s.focus) && view === "files"; // only the Explorer has an exit for it
  useEffect(() => {
    restoreLast().catch(console.warn);
  }, [restoreLast]);

  return (
    <div className="flex h-screen">
      {!focus && <nav className="flex w-14 flex-col items-center gap-2 border-r py-2">
        {VIEWS.map(({ id, label, Icon }) => (
          <Button
            key={id}
            variant="ghost"
            size="icon"
            title={label}
            aria-label={label}
            className={cn(view === id && "bg-accent")}
            onClick={() => setView(id)}
          >
            <Icon />
          </Button>
        ))}
      </nav>}
      {!focus && <aside className="flex min-h-0 w-64 flex-col gap-2 border-r p-3">
        <Button onClick={() => openFolder().catch(console.error)}>Open folder</Button>
        {root && (
          <p className="text-xs text-muted-foreground">
            {root}: {Object.keys(files).length} files
          </p>
        )}
        {view === "docs" && <DocsSidebar />}
        {view === "files" && <FileTree />}
      </aside>}
      <main className="flex min-w-0 flex-1 flex-col">
        {view === "docs" ? (
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
