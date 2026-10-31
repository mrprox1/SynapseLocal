import { useEffect, useMemo, useRef, useState } from "react";
import { File, FileText, KanbanSquare, type LucideIcon } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { fuzzyScore } from "@/lib/fuzzy";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

const ICONS: Record<string, LucideIcon> = { doc: FileText, ticket: KanbanSquare, other: File };
const MAX = 50;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const files = useWorkspace((s) => s.files);
  const recent = useUi((s) => s.recent);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuery("");
        setSel(0);
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey, true); // capture: CodeMirror would swallow it
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const rows = useMemo(() => {
    const all = Object.values(files);
    if (!query) {
      const rank = (p: string) => recent.indexOf(p);
      return all
        .sort((a, b) => {
          const ra = rank(a.path), rb = rank(b.path);
          if (ra >= 0 || rb >= 0) return (ra < 0 ? 1e9 : ra) - (rb < 0 ? 1e9 : rb);
          return a.title.localeCompare(b.title);
        })
        .slice(0, MAX);
    }
    return all
      .map((f) => ({ f, s: fuzzyScore(query, `${f.title} ${f.path}`) }))
      .filter((x): x is { f: (typeof all)[number]; s: number } => x.s !== null)
      .sort((a, b) => b.s - a.s || a.f.title.localeCompare(b.f.title))
      .slice(0, MAX)
      .map((x) => x.f);
  }, [files, query, recent]);

  useEffect(() => {
    list.current?.children[sel]?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const pick = (path: string | undefined) => {
    if (!path) return;
    setOpen(false);
    useUi.getState().openPath(path);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setSel((s) => Math.min(s + 1, rows.length - 1));
    else if (e.key === "ArrowUp") setSel((s) => Math.max(s - 1, 0));
    else if (e.key === "Enter") pick(rows[sel]?.path);
    else return;
    e.preventDefault();
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Go to file" className="top-[15vh] translate-y-0">
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSel(0);
        }}
        onKeyDown={onKeyDown}
        placeholder="Go to file…"
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
      />
      <div ref={list} className="min-h-0 overflow-y-auto">
        {rows.map((f, i) => {
          const Icon = ICONS[f.category] ?? File;
          return (
            <div
              key={f.path}
              onClick={() => pick(f.path)}
              onMouseMove={() => setSel(i)}
              className={cn("flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm", i === sel && "bg-accent")}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{f.title}</span>
              <span className="ml-auto truncate text-xs text-muted-foreground">{f.path}</span>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
