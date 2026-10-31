import { useMemo, useState } from "react";
import { ContextMenu } from "@base-ui/react/context-menu";
import { ask } from "@tauri-apps/plugin-dialog";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildTree, type TreeNode } from "@/lib/tree";
import { sanitizeName } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

type Naming = { kind: "file" | "folder" | "rename"; dir: string; path?: string; value: string };

const itemCls = "cursor-default rounded px-2 py-1 text-sm outline-none data-[highlighted]:bg-accent";

export function FileTree() {
  const files = useWorkspace((s) => s.files);
  const { current, openPath } = useUi();
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [naming, setNaming] = useState<Naming | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tree = useMemo(
    () =>
      buildTree(
        Object.values(files)
          .filter((f) => f.category === "other")
          .map((f) => f.path),
      ),
    [files],
  );

  const submit = async () => {
    const n = naming;
    setNaming(null);
    const name = n && sanitizeName(n.value).replace(/\.md$/i, "");
    if (!n || !name) return;
    const at = (leaf: string) => (n.dir ? `${n.dir}/${leaf}` : leaf);
    const { createFile, moveFile } = useWorkspace.getState();
    setError(null);
    try {
      if (n.kind === "file") {
        await createFile(at(`${name}.md`));
        openPath(at(`${name}.md`));
      } else if (n.kind === "folder") {
        // empty folders are not shown in the tree, so seed one
        await createFile(at(`${name}/untitled.md`));
      } else openPath(await moveFile(n.path!, at(`${name}.md`)));
    } catch (e) {
      setError(String(e));
    }
  };
  const remove = async (path: string) => {
    if (!(await ask(`Move ${path} to the trash?`, { title: "Delete", kind: "warning" }))) return;
    setError(null);
    try {
      await useWorkspace.getState().trashFile(path);
      if (useUi.getState().current === path) useUi.setState({ current: null });
    } catch (e) {
      setError(String(e));
    }
  };

  const row = (n: TreeNode, depth: number) => {
    const folder = !!n.children;
    const open = !closed.has(n.path);
    return (
      <li key={n.path}>
        <ContextMenu.Root>
          <ContextMenu.Trigger
            render={
              <button
                className={cn(
                  "flex w-full items-center gap-1 truncate rounded px-2 py-1 text-left hover:bg-accent",
                  current === n.path && "bg-accent",
                )}
                style={{ paddingLeft: 8 + depth * 12 }}
                onClick={() =>
                  folder
                    ? setClosed((c) => {
                        const next = new Set(c);
                        if (!next.delete(n.path)) next.add(n.path);
                        return next;
                      })
                    : openPath(n.path)
                }
              />
            }
          >
            {folder && (open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />)}
            {n.name}
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup className="z-50 min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                {folder ? (
                  <>
                    <ContextMenu.Item className={itemCls} onClick={() => setNaming({ kind: "file", dir: n.path, value: "" })}>
                      New file
                    </ContextMenu.Item>
                    <ContextMenu.Item className={itemCls} onClick={() => setNaming({ kind: "folder", dir: n.path, value: "" })}>
                      New folder
                    </ContextMenu.Item>
                  </>
                ) : (
                  <>
                    <ContextMenu.Item
                      className={itemCls}
                      onClick={() =>
                        setNaming({
                          kind: "rename",
                          dir: n.path.split("/").slice(0, -1).join("/"),
                          path: n.path,
                          value: n.name.replace(/\.md$/i, ""),
                        })
                      }
                    >
                      Rename
                    </ContextMenu.Item>
                    <ContextMenu.Item className={itemCls} onClick={() => void remove(n.path)}>
                      Delete
                    </ContextMenu.Item>
                  </>
                )}
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
        {folder && open && <ul>{n.children!.map((c) => row(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={() => setNaming({ kind: "file", dir: "", value: "" })}>
          New file
        </Button>
        <Button variant="outline" size="sm" onClick={() => setNaming({ kind: "folder", dir: "", value: "" })}>
          New folder
        </Button>
      </div>
      {naming && (
        <input
          autoFocus
          value={naming.value}
          placeholder={naming.kind === "folder" ? "Folder name" : "File name"}
          className="rounded-md border bg-background px-2 py-1 text-sm"
          onChange={(e) => setNaming({ ...naming, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") setNaming(null);
          }}
          onBlur={() => setNaming(null)}
        />
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <ul className="min-h-0 overflow-auto text-sm">{tree.map((n) => row(n, 0))}</ul>
    </div>
  );
}
