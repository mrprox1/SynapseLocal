import { useEffect, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { ChevronDown, ChevronRight, Check, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { gitColor } from "./GitLabel";

export function SourceControl() {
  const git = useWorkspace((s) => s.git);
  const selected = useUi((s) => s.selected);
  const [msg, setMsg] = useState<string | null>(null); // null = untouched, show the default
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set()); // unchecked paths; everything starts checked
  const [busy, setBusy] = useState(false);
  // forget unchecks for files that are no longer changed, so they start checked if they change again
  useEffect(() => {
    if (git) setSkip((s) => new Set([...s].filter((p) => p in git.files)));
  }, [git]);
  if (!git) return null;

  const changes = Object.entries(git.files).sort(([a], [b]) => a.localeCompare(b));
  const picked = changes.map(([p]) => p).filter((p) => !skip.has(p));
  const message = msg ?? (picked.length ? `Update ${picked.length} notes` : "");
  const canCommit = !!message.trim() && picked.length > 0 && !busy;
  const toggle = (p: string) =>
    setSkip((s) => {
      const n = new Set(s);
      if (!n.delete(p)) n.add(p);
      return n;
    });
  const commit = async () => {
    if (!canCommit) return;
    setBusy(true);
    setError(null);
    try {
      await useWorkspace.getState().commitAll(message.trim(), picked);
      setMsg(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const discard = async (path: string) => {
    if (!(await ask(`Discard changes to ${path}? This can't be undone.`, { kind: "warning" }))) return;
    setBusy(true);
    setError(null);
    try {
      await useWorkspace.getState().discard(path);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-2 text-sm [&>*]:shrink-0 [&>ul]:shrink">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium uppercase tracking-wide text-muted-foreground">Source Control</span>
        <span className="truncate text-muted-foreground">{git.branch}</span>
      </div>
      <textarea
        rows={3}
        value={message}
        placeholder={`Message (Ctrl+Enter to commit on "${git.branch}")`}
        className="resize-none rounded-md border bg-background px-2 py-1"
        onChange={(e) => setMsg(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void commit();
        }}
      />
      <Button size="sm" disabled={!canCommit} onClick={() => void commit()}>
        <Check /> Commit
      </Button>
      {error && (
        <p role="alert" className="whitespace-pre-wrap text-xs text-destructive">
          {error}
        </p>
      )}
      <button className="flex items-center gap-1 text-xs font-medium uppercase" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        Changes
        <span className="ml-1 rounded-full bg-muted px-1.5 text-muted-foreground">{changes.length}</span>
      </button>
      {open && (
        <ul className="min-h-0 overflow-auto">
          {changes.map(([path, code]) => {
            const i = path.lastIndexOf("/");
            const color = { color: gitColor(code) };
            const clickable = /\.md$/i.test(path); // only markdown gets a diff
            return (
              <li key={path} className="group">
                <div className="flex items-center gap-1 pl-1">
                <input type="checkbox" checked={!skip.has(path)} onChange={() => toggle(path)} aria-label={`Include ${path}`} />
                <button
                  disabled={!clickable}
                  title={path}
                  className={cn("flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left", clickable && "hover:bg-accent", selected === path && "bg-accent")}
                  onClick={() => useUi.setState({ selected: path })}
                >
                  <span className={cn("shrink-0", code === "D" && "line-through")} style={color}>
                    {path.slice(i + 1)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{i > 0 && path.slice(0, i)}</span>
                  <span className="ml-auto text-xs" style={color}>{code}</span>
                </button>
                <button
                  title="Discard changes"
                  aria-label={`Discard changes to ${path}`}
                  disabled={busy}
                  className="hidden rounded p-1 text-muted-foreground hover:bg-accent group-hover:block focus-visible:block"
                  onClick={() => void discard(path)}
                >
                  <Undo2 className="size-3.5" />
                </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
