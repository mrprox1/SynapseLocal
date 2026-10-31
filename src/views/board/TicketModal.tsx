import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { PRIORITIES, STATUSES, ticketStatus } from "@/lib/board";
import { removeFrontmatterKey, setFrontmatterKey } from "@/lib/frontmatter";
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

function Text({ path, field, label }: { path: string; field: string; label: string }) {
  const stored = useWorkspace((s) => {
    const v = s.files[path]?.frontmatter[field];
    return v == null ? "" : String(v);
  });
  const [v, setV] = useState(stored);
  return (
    <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
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

export function TicketModal({ path, onClose }: { path: string; onClose: () => void }) {
  const fm = useWorkspace((s) => s.files[path]?.frontmatter);
  const ext = useMemo(() => wikiLinks((t) => openLink(t).catch(console.error)), []);
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
        <Text path={path} field="assignee" label="Assignee" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
        <MarkdownEditor path={path} bodyOnly extensions={[ext]} />
      </div>
    </Dialog>
  );
}
