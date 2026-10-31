import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { resolveLink } from "@/lib/markdown";
import { buildTree, type TreeNode } from "@/lib/tree";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { ask } from "@tauri-apps/plugin-dialog";
import { GitLabel } from "../git/GitLabel";
import { Backlinks } from "./Backlinks";
import { wikiLinks } from "./wikiLinks";

// pulls in @xyflow/react + d3-force; only load when the graph is opened
const GraphView = lazy(() => import("./GraphView").then((m) => ({ default: m.GraphView })));

export async function openLink(target: string) {
  const { files, createDoc } = useWorkspace.getState();
  const hit = resolveLink(target, Object.values(files));
  useUi.getState().openPath(hit ? hit.path : await createDoc(target));
}

export function DocsSidebar() {
  const files = useWorkspace((s) => s.files);
  const docsDir = useWorkspace((s) => s.config.docsDir);
  const { current, openPath } = useUi();
  const [name, setName] = useState<string | null>(null);

  const [closed, setClosed] = useState<Set<string>>(new Set());
  // tree of paths relative to the docs folder; with no subfolders it is a flat list
  const tree = useMemo(
    () =>
      buildTree(
        Object.values(files)
          .filter((f) => f.category === "doc")
          .map((f) => f.path.slice(docsDir.length + 1)),
      ),
    [files, docsDir],
  );
  const title = (rel: string) => files[`${docsDir}/${rel}`].title;

  // folders first (by name, from buildTree), then docs by title
  const rows = (ns: TreeNode[], depth: number): ReactNode[] =>
    [
      ...ns.filter((n) => n.children),
      ...ns.filter((n) => !n.children).sort((a, b) => title(a.path).localeCompare(title(b.path))),
    ].map((n) => {
      const path = `${docsDir}/${n.path}`;
      const open = !closed.has(n.path);
      return (
        <li key={n.path}>
          <button
            className={cn(
              "flex w-full items-center gap-1 truncate rounded px-2 py-1 text-left hover:bg-accent",
              current === path && "bg-accent",
            )}
            style={{ paddingLeft: 8 + depth * 12 }}
            onClick={() =>
              n.children
                ? setClosed((c) => {
                    const next = new Set(c);
                    if (!next.delete(n.path)) next.add(n.path);
                    return next;
                  })
                : openPath(path)
            }
          >
            {n.children && (open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />)}
            <GitLabel path={path} folder={!!n.children}>{n.children ? n.name : title(n.path)}</GitLabel>
          </button>
          {n.children && open && <ul>{rows(n.children, depth + 1)}</ul>}
        </li>
      );
    });

  const create = async () => {
    const n = name?.trim();
    setName(null);
    if (n) openPath(await useWorkspace.getState().createDoc(n));
  };

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {name === null ? (
        <Button variant="outline" size="sm" onClick={() => setName("")}>
          New doc
        </Button>
      ) : (
        <input
          autoFocus
          value={name}
          placeholder="Doc name"
          className="rounded-md border bg-background px-2 py-1 text-sm"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create().catch(console.error);
            if (e.key === "Escape") setName(null);
          }}
          onBlur={() => setName(null)}
        />
      )}
      <ul className="min-h-0 overflow-auto text-sm">{rows(tree, 0)}</ul>
    </div>
  );
}

export function DocsMain() {
  const current = useUi((s) => s.current);
  const exists = useWorkspace((s) => current != null && s.files[current]?.category === "doc");
  const [preview, setPreview] = useState(false);
  const graph = useUi((s) => s.graph);
  const [renaming, setRenaming] = useState<string | null>(null);
  const rename = async () => {
    const n = renaming?.trim();
    setRenaming(null);
    if (!n || !current) return;
    const { renameDoc } = useWorkspace.getState();
    const path = await renameDoc(current, n, (links, files) =>
      ask(`Update ${links} links in ${files} files?`, { title: "Rename", kind: "warning" }),
    );
    useUi.getState().openPath(path);
  };
  const ext = useMemo(() => wikiLinks((t) => openLink(t).catch(console.error)), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setPreview((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!graph && (!current || !exists))
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Select a doc</div>;
  return (
    <>
      <div className="flex justify-end gap-1 border-b px-2 py-1">
        <Button variant="ghost" size="sm" onClick={() => useUi.setState({ graph: !graph })}>
          {graph ? "Doc" : "Graph"}
        </Button>
        {!graph &&
          (renaming === null ? (
            <Button variant="ghost" size="sm" onClick={() => setRenaming(current!.split("/").pop()!.replace(/\.md$/i, ""))}
              title="Rename file"
            >
              Rename
            </Button>
          ) : (
            <input
              autoFocus
              value={renaming}
              className="rounded-md border bg-background px-2 text-sm"
              onChange={(e) => setRenaming(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") rename().catch((err) => window.alert(String(err)));
                if (e.key === "Escape") setRenaming(null);
              }}
              onBlur={() => setRenaming(null)}
            />
          ))}
        {!graph && (
          <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)} title="Ctrl+E">
            {preview ? "Edit" : "Preview"}
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {graph ? (
          <Suspense><GraphView /></Suspense>
        ) : preview ? (
          <MarkdownPreview path={current!} onLink={(t) => openLink(t).catch(console.error)} />
        ) : (
          <MarkdownEditor path={current!} extensions={[ext]} />
        )}
      </div>
      {!graph && current && <Backlinks path={current} />}
    </>
  );
}
