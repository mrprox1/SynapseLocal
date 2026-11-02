import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Eye, MessageSquare, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MarkdownEditor, MarkdownInput } from "@/components/MarkdownEditor";
import { MarkdownBody, MarkdownPreview } from "@/components/MarkdownPreview";
import { addComment, parseComments } from "@/lib/comments";
import { isArchived, localDate, PRIORITIES, STATUS_TINT, STATUSES, ticketDue, ticketStatus } from "@/lib/board";

import { setTicketField, TICKET_FIELDS } from "@/lib/tickets";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";
import { openLink } from "@/views/docs/DocsView";
import { wikiLinks } from "@/views/docs/wikiLinks";

const input = "rounded-md border bg-background px-2 py-1 text-sm font-normal";

/** Empty value removes the key; otherwise sets it. */
function put(path: string, key: string, value: string) {
  const { files, writeFile } = useWorkspace.getState();
  const c = files[path]?.content ?? "";
  const next = setTicketField(c, key, value);
  if (next !== c) writeFile(path, next).catch(console.error);
}

function Text({ path, field, label, className, big }: { path: string; field: string; label: string; className?: string; big?: boolean }) {
  const stored = useWorkspace((s) => {
    const file = s.files[path];
    const v = field === "title" ? file?.title : file?.frontmatter[field];
    return Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
  });
  const [v, setV] = useState(stored);
  useEffect(() => setV(stored), [stored]); // picks up edits made on disk
  return (
    <label className={cn("flex flex-col gap-1 text-sm font-semibold text-muted-foreground", className)}>
      {label}
      <input
        className={cn(input, "min-w-0 w-full", big && "px-2 py-1.5 text-xl font-bold")}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v.trim() !== stored && (field !== "title" || v.trim()) && put(path, field, v.trim())}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
    </label>
  );
}

const AUTHOR_KEY = "synapse.author";
const get = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };

function Comments({ path }: { path: string }) {
  const content = useWorkspace((s) => s.files[path]?.content ?? "");
  const comments = parseComments(content);
  const [author, setAuthor] = useState(() => get(AUTHOR_KEY));
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ok = !!text.trim() && !!author.trim();
  const submit = () => {
    if (!ok) return;
    try { localStorage.setItem(AUTHOR_KEY, author.trim()); } catch { /* remembering the name is optional */ }
    const now = new Date();
    const date = `${localDate(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const latest = useWorkspace.getState().files[path]?.content ?? content;
    useWorkspace.getState().writeFile(path, addComment(latest, author.trim(), text, date)).then(() => setText(""), (e) => setErr(String(e)));
  };
  return (
    <aside className="flex min-h-64 w-full shrink-0 flex-col gap-2 border-t pt-4 text-sm xl:min-h-0 xl:w-72 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-4">
      <div className="text-sm font-semibold text-muted-foreground">Comments {comments.length > 0 && comments.length}</div>
      {comments.length > 0 && (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-auto">
          {comments.map((c, i) => (
            <li key={i} className="py-3 first:pt-0">
              <div className="text-xs text-muted-foreground">{c.author} · {c.date}</div>
              <div className="prose-preview [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap"><MarkdownBody body={c.text} path={path} onLink={(t) => openLink(t).catch(console.error)} /></div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-col gap-2">
        <input className={input} placeholder="Your name" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <MarkdownInput value={text} onChange={setText} onSubmit={submit} placeholder="Add a comment… (Ctrl+Enter)" />
        <Button size="sm" className="self-end" disabled={!ok} onClick={submit}>Add</Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </aside>
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
  const [showComments, setShowComments] = useState(() => parseComments(useWorkspace.getState().files[path]?.content ?? "").length > 0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setEditing((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!fm) return null;
  const priority = typeof fm.priority === "string" ? fm.priority : "";
  return (
    <Dialog open onClose={onClose} title="Ticket" className="h-[90vh] max-h-[92vh] w-[min(96rem,96vw)]">
      <div className="flex shrink-0 items-start gap-3">
        <Text path={path} field="title" label="Title" big className="min-w-0 flex-1" />
        <Button type="button" variant="ghost" size="icon" title="Close ticket" aria-label="Close ticket" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto xl:flex-row xl:overflow-hidden">
      <div className="flex min-w-0 shrink-0 flex-col gap-4 md:min-h-96 md:flex-row xl:min-h-0 xl:flex-1 xl:shrink">
      <aside aria-label="Ticket fields" className="max-h-[36vh] shrink-0 overflow-auto border-b pb-4 pr-1 md:max-h-none md:w-72 md:border-b-0 md:border-r md:pb-0 md:pr-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted-foreground">
          Status
          <select className={cn(input, STATUS_TINT[ticketStatus(fm)])} value={ticketStatus(fm)} onChange={(e) => put(path, "status", e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted-foreground">
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
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted-foreground">
          Due
          {/* uncontrolled, saved on blur: a controlled value would reset while the year is half typed */}
          <input
            key={ticketDue(fm)}
            type="date"
            className={cn(input, "min-w-0 w-full")}
            defaultValue={ticketDue(fm) ?? ""}
            onBlur={(e) => e.target.value !== (ticketDue(fm) ?? "") && put(path, "due_date", e.target.value)}
          />
        </label>
        <Text path={path} field="assignee" label="Assignee" className="min-w-0" />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3">
        {TICKET_FIELDS.map(({ key, label }) => (
          <Text key={key} path={path} field={key} label={label} className="min-w-0" />
        ))}
      </div>
      {Array.isArray(fm.linked_documents) && fm.linked_documents.length > 0 && (
        <ul aria-label="Linked Documents" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {fm.linked_documents.map((document, index) => (
            <li key={index} className="min-w-0 max-w-full break-words">
              <button className="text-blue-600 underline dark:text-blue-400" onClick={() => openLink(String(document)).catch(console.error)}>{String(document)}</button>
            </li>
          ))}
        </ul>
      )}
      </aside>
      <div className="min-h-64 min-w-0 flex-1 overflow-hidden rounded-md border md:min-h-0">
        {editing ? (
          <MarkdownEditor path={path} bodyOnly extensions={[ext]} />
        ) : (
          <MarkdownPreview hideComments path={path} onLink={(t) => openLink(t).catch(console.error)} />
        )}
      </div>
      </div>
      <div className="flex shrink-0 gap-2 xl:flex-col">
        <Button
          variant={showComments ? "secondary" : "outline"}
          size="icon"
          title={showComments ? "Hide comments" : "Comments"}
          aria-label={showComments ? "Hide comments" : "Comments"}
          onClick={() => setShowComments((v) => !v)}
        >
          <MessageSquare />
        </Button>
        {(archived || ticketStatus(fm) === "done") && (
          <Button
            variant="outline"
            size="icon"
            title={archived ? "Restore" : "Archive"}
            aria-label={archived ? "Restore" : "Archive"}
            onClick={archived ? onRestore : onArchive}
          >
            {archived ? <ArchiveRestore /> : <Archive />}
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          title={(editing ? "Preview" : "Edit") + " (Ctrl+E)"}
          aria-label={editing ? "Preview" : "Edit"}
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? <Eye /> : <Pencil />}
        </Button>
      </div>
      {showComments && <Comments path={path} />}
      </div>
    </Dialog>
  );
}
