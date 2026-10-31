import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { resolveLink } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { ask } from "@tauri-apps/plugin-dialog";
import { Backlinks } from "./Backlinks";
import { GraphView } from "./GraphView";
import { wikiLinks } from "./wikiLinks";

export async function openLink(target: string) {
  const { files, createDoc } = useWorkspace.getState();
  const hit = resolveLink(target, Object.values(files).filter((f) => f.category !== "ticket"));
  useUi.getState().openPath(hit ? hit.path : await createDoc(target));
}

export function DocsSidebar() {
  const files = useWorkspace((s) => s.files);
  const docsDir = useWorkspace((s) => s.config.docsDir);
  const { current, openPath } = useUi();
  const [name, setName] = useState<string | null>(null);

  const docs = Object.values(files)
    .filter((f) => f.category === "doc")
    .sort((a, b) => a.title.localeCompare(b.title));

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
      <ul className="min-h-0 overflow-auto text-sm">
        {docs.map((f) => {
          // shortcut: flat list with the subfolder shown as a prefix, no tree until task 015
          const sub = f.path.slice(docsDir.length + 1).split("/").slice(0, -1).join("/");
          return (
            <li key={f.path}>
              <button
                className={cn(
                  "w-full truncate rounded px-2 py-1 text-left hover:bg-accent",
                  current === f.path && "bg-accent",
                )}
                onClick={() => openPath(f.path)}
              >
                {sub && <span className="text-muted-foreground">{sub}/ </span>}
                {f.title}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DocsMain() {
  const current = useUi((s) => s.current);
  const exists = useWorkspace((s) => current != null && s.files[current]?.category === "doc");
  const [preview, setPreview] = useState(false);
  const [graph, setGraph] = useState(false);
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
        <Button variant="ghost" size="sm" onClick={() => setGraph((g) => !g)}>
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
          <GraphView />
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
