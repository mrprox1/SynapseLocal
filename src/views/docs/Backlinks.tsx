import { useMemo } from "react";
import { resolveLink } from "@/lib/markdown";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

export function Backlinks({ path }: { path: string }) {
  const files = useWorkspace((s) => s.files);
  const openPath = useUi((s) => s.openPath);

  // shortcut: full scan on every change, build an inverted index if workspaces get big
  const hits = useMemo(() => {
    const targets = Object.values(files);
    return Object.values(files)
      .filter((f) => f.path !== path && f.links.some((t) => resolveLink(t, targets)?.path === path))
      .map((f) => {
        const mine = f.links.filter((t) => resolveLink(t, targets)?.path === path);
        const line = f.content.split(/\r?\n/).find((l) => mine.some((t) => l.includes("[[" + t))) ?? "";
        return { f, line: line.trim() };
      })
      .sort((a, b) => a.f.title.localeCompare(b.f.title));
  }, [files, path]);

  return (
    <div className="max-h-40 overflow-auto border-t p-2 text-sm">
      <div className="mb-1 font-medium">Backlinks</div>
      {hits.length === 0 && <p className="text-muted-foreground">No backlinks</p>}
      {hits.map(({ f, line }) => (
        <button key={f.path} className="block w-full rounded px-2 py-1 text-left hover:bg-accent" onClick={() => openPath(f.path)}>
          <span>{f.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{line}</span>
        </button>
      ))}
    </div>
  );
}
