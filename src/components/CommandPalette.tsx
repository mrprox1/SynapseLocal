import { useEffect, useMemo, useRef, useState } from "react";
import { File, FileText, KanbanSquare, type LucideIcon } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { COMMANDS, type Prompt } from "@/lib/commands";
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
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuery(e.shiftKey ? ">" : "");
        setSel(0);
        setPrompt(null);
        setError("");
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey, true); // capture: CodeMirror would swallow it
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const cmdMode = !prompt && query.startsWith(">");
  const cmds = useMemo(() => {
    if (!cmdMode || !open) return [];
    const q = query.slice(1).trim();
    return COMMANDS.filter((c) => !c.when || c.when())
      .map((c) => ({ c, s: q ? fuzzyScore(q, c.label) : 0 }))
      .filter((x): x is { c: (typeof COMMANDS)[number]; s: number } => x.s !== null)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX)
      .map((x) => x.c);
  }, [cmdMode, open, query]);

  const rows = useMemo(() => {
    if (cmdMode || prompt) return [];
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
  }, [files, query, recent, cmdMode, prompt]);

  useEffect(() => {
    list.current?.children[sel]?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const pick = (path: string | undefined) => {
    if (!path) return;
    setOpen(false);
    useUi.getState().openPath(path);
  };

  const n = cmdMode ? cmds.length : rows.length;
  const runCmd = (c: (typeof COMMANDS)[number] | undefined) => {
    if (!c) return;
    const p = c.run();
    if (p) {
      setPrompt(p);
      setQuery("");
    } else setOpen(false);
  };
  const submit = () => {
    const name = query.trim();
    if (!prompt || !name) return;
    prompt
      .submit(name)
      .then((path) => {
        setOpen(false);
        useUi.getState().openPath(path);
      })
      .catch((err) => setError(String(err)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setSel((s) => Math.min(s + 1, n - 1));
    else if (e.key === "ArrowUp") setSel((s) => Math.max(s - 1, 0));
    else if (e.key === "Enter") prompt ? submit() : cmdMode ? runCmd(cmds[sel]) : pick(rows[sel]?.path);
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
          setError("");
          setSel(0);
        }}
        onKeyDown={onKeyDown}
        placeholder={prompt?.placeholder ?? "Go to file…  (> for commands)"}
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
      />
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div ref={list} className="min-h-0 overflow-y-auto">
        {cmds.map((c, i) => (
          <div
            key={c.label}
            onClick={() => runCmd(c)}
            onMouseMove={() => setSel(i)}
            className={cn("cursor-pointer rounded px-2 py-1.5 text-sm", i === sel && "bg-accent")}
          >
            {c.label}
          </div>
        ))}
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
