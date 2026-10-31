import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { isArchived, PRIORITIES, STATUSES, ticketStatus } from "@/lib/board";
import { removeFrontmatterKey, setFrontmatterKey } from "@/lib/frontmatter";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";
import { openLink } from "@/views/docs/DocsView";
import { wikiLinks } from "@/views/docs/wikiLinks";

const input = "rounded-md border bg-background px-2 py-1 text-sm";

/** Empty value removes the key; otherwise sets it. */
function put(path: string, key: string, value: string) {
  const { files, writeFile } = useWorkspace.getState();
  const c = files[path]?.content ?? "";
  const next = value === "" ? removeFrontmatterKey(c, key) : setFrontmatterKey(c, key, value);
  if (next !== c) writeFile(path, next).catch(console.error);
}

function Text({ path, field, label, className }: { path: string; field: string; label: string; className?: string }) {
  const stored = useWorkspace((s) => {
    const v = s.files[path]?.frontmatter[field];
    return v == null ? "" : String(v);
  });
  const [v, setV] = useState(stored);
  return (
    <label className={cn("flex flex-col gap-1 text-xs text-muted-foreground", className)}>
      {label}
      <input
        className={input}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v.trim() !== stored && (field !== "title" || v.trim()) && put(path, field, v.trim())}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
    </label>
  );
}

export function TicketModal({
  path,
  onClose,
  onArchive,
  onRestore,
}: {
  path: string;
  onClose: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const archived = useWorkspace((s) => isArchived(path, s.config.ticketsDir));
  const fm = useWorkspace((s) => s.files[path]?.frontmatter);
  const ext = useMemo(() => wikiLinks((t) => openLink(t).catch(console.error)), []);
  const [editing, setEditing] = useState(false); // body opens as preview
  if (!fm) return null;
  const priority = typeof fm.priority === "string" ? fm.priority : "";
  return (
    <Dialog open onClose={onClose} title="Ticket" className="h-[80vh]">
      <Text path={path} field="title" label="Title" />
      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Status
          <select className={input} value={ticketStatus(fm)} onChange={(e) => put(path, "status", e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Priority
          <select className={input} value={priority} onChange={(e) => put(path, "priority", e.target.value)}>
            <option value="">None</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <Text path={path} field="assignee" label="Assignee" className="flex-1" />
        {(archived || ticketStatus(fm) === "done") && (
          <Button variant="outline" size="sm" className="self-end" onClick={archived ? onRestore : onArchive}>
            {archived ? "Restore" : "Archive"}
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        Body
        <Button variant="ghost" size="xs" onClick={() => setEditing((e) => !e)}>
          {editing ? "Preview" : "Edit"}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
        {editing ? (
          <MarkdownEditor path={path} bodyOnly extensions={[ext]} />
        ) : (
          <MarkdownPreview path={path} onLink={(t) => openLink(t).catch(console.error)} />
        )}
      </div>
    </Dialog>
  );
}
