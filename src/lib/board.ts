export const STATUSES = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
] as const;
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
