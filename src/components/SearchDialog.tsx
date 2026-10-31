import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { linkLabel } from "@/lib/board";
import { search, type Result, type Scope } from "@/lib/search";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "doc", label: "Docs" },
  { id: "ticket", label: "Tickets" },
  { id: "other", label: "Files" },
];

export function SearchDialog() {
  const open = useUi((s) => s.searchOpen);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [sel, setSel] = useState(0);
  const files = useWorkspace((s) => s.files);
  const ticketsDir = useWorkspace((s) => s.config.ticketsDir);
  const list = useRef<HTMLDivElement>(null);
  const deferred = useDeferredValue(query);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setQuery("");
        setSel(0);
        useUi.setState({ searchOpen: true });
      }
    };
    window.addEventListener("keydown", onKey, true); // capture: CodeMirror would swallow it
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const results = useMemo(
    () => (open ? search(Object.values(files), deferred, scope, ticketsDir) : []),
    [open, files, deferred, scope, ticketsDir],
  );

  useEffect(() => {
    list.current?.children[sel]?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const close = () => useUi.setState({ searchOpen: false });
  const pick = (r: Result | undefined, line = r?.lines[0]) => {
    if (!r) return;
    close();
    useUi.setState({ jump: line ? { path: r.path, from: line.from, to: line.to } : null });
    useUi.getState().openPath(r.path);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setSel((s) => Math.min(s + 1, results.length - 1));
    else if (e.key === "ArrowUp") setSel((s) => Math.max(s - 1, 0));
    else if (e.key === "Enter") pick(results[sel]);
    else return;
    e.preventDefault();
  };

  return (
    <Dialog open={open} onClose={close} title="Search in files" className="top-[15vh] translate-y-0">
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSel(0);
        }}
        onKeyDown={onKeyDown}
        placeholder='Search in files…  ("quoted phrase")'
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
      />
      <div className="flex gap-1">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setScope(s.id);
              setSel(0);
            }}
            className={cn("rounded-full border px-3 py-0.5 text-xs", scope === s.id && "bg-accent")}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div ref={list} className="min-h-0 overflow-y-auto">
        {results.map((r, i) => (
          <div
            key={r.path}
            onClick={() => pick(r)}
            onMouseMove={() => setSel(i)}
            className={cn("cursor-pointer rounded px-2 py-1.5 text-sm", i === sel && "bg-accent")}
          >
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{linkLabel(r.title, !!r.archived)}</span>
              <span className="ml-auto truncate text-xs text-muted-foreground">{r.path}</span>
            </div>
            {r.lines.map((l) => (
              <div
                key={l.line}
                onClick={(e) => {
                  e.stopPropagation();
                  pick(r, l);
                }}
                className="truncate text-xs text-muted-foreground">
                {l.text.slice(0, l.col)}
                <mark>{l.text.slice(l.col, l.col + l.to - l.from)}</mark>
                {l.text.slice(l.col + l.to - l.from)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
