export const STATUSES = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
] as const;
/** Soft per-status color for column headers and the ticket's status field. */
export const STATUS_TINT: Record<string, string> = {
  backlog: "bg-slate-500/15",
  todo: "bg-blue-500/15",
  "in-progress": "bg-amber-500/15",
  done: "bg-green-500/15",
};
export type Status = (typeof STATUSES)[number]["id"];
export const PRIORITIES = ["low", "medium", "high"] as const;

/** Strict match; anything missing or unknown lands in Backlog. */
export const ticketStatus = (fm: Record<string, unknown>): Status =>
  STATUSES.find((s) => s.id === fm.status)?.id ?? "backlog";

export const ticketOrder = (fm: Record<string, unknown>) =>
  typeof fm.order === "number" && Number.isFinite(fm.order) ? fm.order : undefined;

/** Counts `- [ ]` / `- [x]` items. */
export function subtasks(body: string) {
  const all = body.match(/^[ \t]*[-*+][ \t]+\[[ xX]\]/gm) ?? [];
  return { done: all.filter((m) => !m.endsWith("[ ]")).length, total: all.length };
}

type Card = { path: string; order?: number };

/** Ordered cards first (ascending), then the rest by filename. */
export function sortCards<T extends Card>(cards: T[]): T[] {
  return [...cards].sort((a, b) =>
    a.order != null && b.order != null
      ? a.order - b.order || a.path.localeCompare(b.path)
      : a.order != null
        ? -1
        : b.order != null
          ? 1
          : a.path.localeCompare(b.path),
  );
}

/**
 * New `order` values after inserting `moved` at `index` of `list` (which excludes it).
 * Normally only the moved card gets a value (midpoint of its neighbours); if the card before
 * it has no `order`, the whole column is numbered 1..n so the position sticks.
 */
export function placeCard(list: Card[], moved: string, index: number): Record<string, number> {
  const prev = list[index - 1];
  const next = list[index];
  if (prev && prev.order == null) {
    const ids = list.map((c) => c.path);
    ids.splice(index, 0, moved);
    return Object.fromEntries(ids.map((p, i) => [p, i + 1]));
  }
  const n = next?.order;
  const v = prev ? (n != null ? (prev.order! + n) / 2 : prev.order! + 1) : n != null ? n - 1 : 1;
  return { [moved]: v };
}

export const slugify = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "ticket";

/** `<dir>/<slug>.md`, or `<slug>-2.md`, `-3`… if taken (case-insensitive). */
export function uniquePath(dir: string, slug: string, taken: Iterable<string>) {
  const have = new Set([...taken].map((p) => p.toLowerCase()));
  let p = `${dir}/${slug}.md`;
  for (let i = 2; have.has(p.toLowerCase()); i++) p = `${dir}/${slug}-${i}.md`;
  return p;
}

export const UNASSIGNED = "__none";
export type Filter = { priorities: string[]; assignee: string }; // assignee "" = anyone
export const NO_FILTER: Filter = { priorities: [], assignee: "" };

/** Empty priorities = all; missing priority counts as "none". */
export const matchesFilter = (c: { priority?: string; assignee?: string }, f: Filter) =>
  (!f.priorities.length || f.priorities.includes(c.priority ?? "none")) &&
  (!f.assignee || (f.assignee === UNASSIGNED ? !c.assignee : c.assignee === f.assignee));

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** Tickets are archived by location: anywhere under `<ticketsDir>/archive/`. */
export const isArchived = (path: string, ticketsDir: string) => path.startsWith(`${ticketsDir}/archive/`);
export const archivePath = (path: string, ticketsDir: string) => `${ticketsDir}/archive/${baseName(path)}`;
export const restorePath = (path: string, ticketsDir: string) => `${ticketsDir}/${baseName(path)}`;

/** Label shown for a link to `path`. */
export const linkLabel = (label: string, archived: boolean) => (archived ? `Archive: ${label}` : label);

const pad = (n: number) => String(n).padStart(2, "0");
export const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** `YYYY-MM-DD` string (or a Date, if the YAML parser made one); anything else is ignored. */
export const ticketDue = (fm: Record<string, unknown>) => dateKey(fm.due_date);
export const ticketArchivedAt = (fm: Record<string, unknown>) => dateKey(fm.archived_at);

function dateKey(v: unknown): string | undefined {
  if (v instanceof Date) return Number.isNaN(+v) ? undefined : v.toISOString().slice(0, 10); // YAML dates are UTC
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

/** `today` is a local `YYYY-MM-DD`. Done tickets are never due. */
export const dueState = (due: string | undefined, status: Status, today: string) =>
  !due || status === "done" ? undefined : due < today ? "overdue" : due === today ? "today" : undefined;

/** Not done and due within `days` days of `today` (overdue included): gets the red border. */
export function dueNear(due: string | undefined, status: Status, today: string, days: number) {
  if (!due || status === "done") return false;
  const [y, m, d] = today.split("-").map(Number);
  return due <= localDate(new Date(y, m - 1, d + days));
}

/** Archived cards grouped by `archivedAt`, newest day first; cards without a date go last under `""`. */
export function groupArchived<T extends { path: string; archivedAt?: string }>(cards: T[]) {
  const by = new Map<string, T[]>();
  for (const c of [...cards].sort((a, b) => a.path.localeCompare(b.path))) {
    const k = c.archivedAt ?? "";
    by.set(k, [...(by.get(k) ?? []), c]);
  }
  return [...by].sort(([a], [b]) => (a && b ? b.localeCompare(a) : a ? -1 : b ? 1 : 0));
}

/** `Jun 1`, with the year when it isn't the current one. */
export function dueLabel(due: string, today: string) {
  const [y, m, d] = due.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(due.slice(0, 4) !== today.slice(0, 4) && { year: "numeric" }),
  });
}
