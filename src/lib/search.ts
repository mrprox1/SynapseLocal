import { isArchived } from "@/lib/board";
import type { FileEntry } from "@/store/workspace";

export type Scope = "all" | "doc" | "ticket" | "other";
export type Result = {
  path: string;
  title: string;
  archived?: boolean;
  hits: number;
  /** `from`/`to`: the hit's character offsets in the file's `content`; `col`: its offset within `text`. */
  lines: { line: number; text: string; col: number; from: number; to: number }[];
};

const MAX_FILES = 100;
const MAX_LINES = 3;

/** Words are ANDed; "quoted phrases" are one term. Lowercased. */
export function parseQuery(q: string): string[] {
  return [...q.matchAll(/"([^"]+)"|(\S+)/g)].map((m) => (m[1] ?? m[2]).toLowerCase());
}

// shortcut: linear scan of in-memory content, switch to FlexSearch if it gets measurably slow
export function search(files: FileEntry[], query: string, scope: Scope, ticketsDir = ""): Result[] {
  const terms = parseQuery(query);
  if (!terms.length) return [];
  const out: (Result & { titleHit: boolean })[] = [];
  for (const f of files) {
    if (scope !== "all" && f.category !== scope) continue;
    const text = f.content.toLowerCase();
    if (!terms.every((t) => text.includes(t))) continue;
    let hits = 0;
    const lines: Result["lines"] = [];
    let offset = 0;
    f.content.split("\n").forEach((raw, i) => {
      const low = text.slice(offset, offset + raw.length);
      let col = -1, len = 0;
      for (const t of terms) {
        for (let at = low.indexOf(t); at >= 0; at = low.indexOf(t, at + t.length)) {
          hits++;
          if (col < 0 || at < col) (col = at), (len = t.length);
        }
      }
      if (col >= 0 && lines.length < MAX_LINES)
        lines.push({ line: i + 1, text: raw, col, from: offset + col, to: offset + col + len });
      offset += raw.length + 1;
    });
    const title = f.title.toLowerCase();
    out.push({
      path: f.path,
      title: f.title,
      archived: (f.category === "ticket" && isArchived(f.path, ticketsDir)) || undefined,
      hits,
      lines,
      titleHit: terms.some((t) => title.includes(t)),
    });
  }
  return out
    .sort((a, b) => +b.titleHit - +a.titleHit || b.hits - a.hits)
    .slice(0, MAX_FILES)
    .map(({ titleHit: _, ...r }) => r);
}
