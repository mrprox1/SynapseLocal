import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Eye, MessageSquare, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MarkdownEditor, MarkdownInput } from "@/components/MarkdownEditor";
import { MarkdownBody, MarkdownPreview } from "@/components/MarkdownPreview";
import { addComment, parseComments } from "@/lib/comments";
import { isArchived, localDate, PRIORITIES, STATUS_TINT, STATUSES, ticketDue, ticketStatus } from "@/lib/board";

import { fuzzyScore } from "@/lib/fuzzy";
import { resolveLink } from "@/lib/markdown";
import { addLink, removeLink, setTicketField } from "@/lib/tickets";
import { cn } from "@/lib/utils";
import { useWorkspace, type FileEntry } from "@/store/workspace";
import { openLink } from "@/views/docs/DocsView";
import { wikiLinks } from "@/views/docs/wikiLinks";

const input = "rounded-md border bg-background px-2 py-1 text-sm font-normal";

/** Empty value removes the key; otherwise sets it. */
function put(path: string, key: string, value: string) {
  const { files, writeFile } = useWorkspace.getState();
  const c = files[path]?.content ?? "";
  const next = setTicketField(c, key, value, useWorkspace.getState().config.ticketFields);
  if (next !== c) writeFile(path, next).catch(console.error);
}

const ORDER = { doc: 0, other: 1, ticket: 2 };
const stemOf = (p: string) => p.split("/").pop()!.replace(/\.md$/i, "");

/** Chips for the linked files of one `links` field plus a fuzzy add box that stays open between picks. */
function LinkedDocs({ path, field, label }: { path: string; field: string; label: string }) {
  const files = useWorkspace((s) => s.files);
  const stored = useWorkspace((s) => s.files[path]?.frontmatter[field]);
  const list = (Array.isArray(stored) ? stored : []).map(String);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const all = useMemo(() => Object.values(files), [files]);
  const resolved = list.map((l) => resolveLink(l.replace(/^\[\[|\]\]$/g, ""), all));
  const linked = new Set(resolved.map((f) => f?.path));
  const hits = all
    .filter((f) => f.path !== path && !linked.has(f.path))
    .map((f) => ({ f, s: q ? fuzzyScore(q, `${f.title} ${f.path}`) : 0 }))
    .filter((x): x is { f: FileEntry; s: number } => x.s !== null)
    .sort((a, b) => ORDER[a.f.category] - ORDER[b.f.category] || b.s - a.s || a.f.path.localeCompare(b.f.path))
    .slice(0, 8);
  const save = (next: string[]) => put(path, field, next.join(", "));
  const add = (f: FileEntry) => { save(addLink(list, stemOf(f.path))); setQ(""); setSel(0); };
  return (
    <div className="relative flex flex-col gap-1 text-sm font-semibold text-muted-foreground">
      {label}
      <div className="flex flex-wrap gap-1">
        {list.map((l, i) => (
          <span key={i} title={resolved[i] ? resolved[i]!.path : `No file named ${l}`} className={cn("inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 font-normal", !resolved[i] && "border-amber-500 text-amber-600 dark:text-amber-400")}>
            <button type="button" className="min-w-0 truncate underline" onClick={() => openLink(l.replace(/^\[\[|\]\]$/g, "")).catch(console.error)}>{!resolved[i] && "⚠ "}{l}</button>
            <button type="button" aria-label={`Remove ${l}`} onClick={() => save(removeLink(list, i))}><X className="size-3" /></button>
          </span>
        ))}
      </div>
      <input
        className={cn(input, "min-w-0 w-full")}
        placeholder="+ Link documents…"
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => { setQ(e.target.value); setSel(0); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setSel((v) => Math.max(0, Math.min(hits.length - 1, v + (e.key === "ArrowDown" ? 1 : -1))));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && hits[sel]) add(hits[sel].f);
          } else if (e.key === "Escape" && open) {
            e.stopPropagation(); // don't close the ticket window
            setOpen(false);
          } else if (e.key === "Backspace" && !q && list.length) save(removeLink(list, list.length - 1));
        }}
      />
      {open && hits.length > 0 && (
        <ul role="listbox" className="absolute top-full z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover font-normal text-popover-foreground shadow-md">
          {hits.map(({ f }, i) => (
            // mousedown, not click: the input's blur would close the list first
            <li key={f.path} role="option" aria-selected={i === sel} className={cn("cursor-pointer px-2 py-1", i === sel && "bg-accent")} onMouseDown={(e) => { e.preventDefault(); add(f); }}>
              <div className="truncate">{f.title}</div>
              <div className="truncate text-xs text-muted-foreground">{f.path}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
  const ticketFields = useWorkspace((s) => s.config.ticketFields);
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
        {ticketFields.map(({ key, label, type }) =>
          type === "links" ? <LinkedDocs key={key} path={path} field={key} label={label} /> : <Text key={key} path={path} field={key} label={label} className="min-w-0" />,
        )}
      </div>
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
