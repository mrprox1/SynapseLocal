import { cleanTicketFields, DEFAULT_TICKET_FIELDS, type TicketField } from "./tickets";

export type Config = { docsDir: string; ticketsDir: string; dueSoonDays: number; ticketFields: TicketField[]; skip: string[] };
export type Category = "doc" | "ticket" | "other";

export const DEFAULT_CONFIG: Config = { docsDir: "docs", ticketsDir: "tickets", dueSoonDays: 2, ticketFields: DEFAULT_TICKET_FIELDS, skip: ["node_modules"] };

/** Invalid JSON or non-string keys fall back to defaults. */
export function parseConfig(text: string | null): Config {
  if (text == null) return DEFAULT_CONFIG;
  try {
    const j = JSON.parse(text);
    const dir = (v: unknown, d: string) =>
      typeof v === "string" && v.trim() ? v.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") : d;
    return {
      docsDir: dir(j?.docsDir, DEFAULT_CONFIG.docsDir),
      ticketsDir: dir(j?.ticketsDir, DEFAULT_CONFIG.ticketsDir),
      dueSoonDays: Number.isInteger(j?.dueSoonDays) && j.dueSoonDays >= 0 ? j.dueSoonDays : DEFAULT_CONFIG.dueSoonDays,
      ticketFields: cleanTicketFields(j?.ticketFields) ?? DEFAULT_TICKET_FIELDS,
      skip: Array.isArray(j?.skip) ? cleanSkip(j.skip) : DEFAULT_CONFIG.skip,
    };
  } catch {
    console.warn(".synapse.json is not valid JSON; using defaults");
    return DEFAULT_CONFIG;
  }
}

const clean = (v: string) => v.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

/** Trimmed, forward-slash entries; drops empty ones and anything with `..`. */
export const cleanSkip = (v: unknown[]) =>
  [...new Set(v.flatMap((e) => (typeof e === "string" ? [clean(e)] : [])).filter((e) => e && !e.split("/").includes("..")))];

/** Error message for a folder setting, or null if fine. `other` is the sibling setting it must differ from. */
export function validateDir(value: string, other: string): string | null {
  const v = value.trim().replace(/\\/g, "/");
  if (!clean(v)) return "Folder can't be empty";
  if (v.startsWith("/") || /^[a-zA-Z]:/.test(v) || v.split("/").includes("..")) return "Folder must be inside the workspace";
  if (clean(v) === clean(other)) return "Docs and tickets folders must differ";
  return null;
}

/** Root-relative form of an absolute `picked` path, or null when it isn't under `root`. */
export function relativeTo(root: string, picked: string): string | null {
  const p = picked.replace(/\\/g, "/").replace(/\/+$/, "");
  return p.startsWith(root + "/") ? p.slice(root.length + 1) : null;
}

/** Normalised form saved to `.synapse.json`. */
export const cleanDir = clean;

/** `rel` is root-relative with forward slashes. When one folder is inside the other (e.g. `docs/tasks`), the deeper one wins. */
export function categorize(rel: string, c: Config): Category {
  const inDocs = rel.startsWith(c.docsDir + "/");
  const inTickets = rel.startsWith(c.ticketsDir + "/");
  if (inDocs && inTickets) return c.ticketsDir.length > c.docsDir.length ? "ticket" : "doc";
  return inDocs ? "doc" : inTickets ? "ticket" : "other";
}

/** Strip characters that are illegal in Windows filenames (and path separators). */
export const sanitizeName = (name: string) => name.replace(/[\\/:*?"<>|]/g, "").trim();

/**
 * What a watcher change to `rel` (workspace-relative) needs: nothing (`.git` / `node_modules`
 * noise), a git refresh (other dot-paths, which the index skips), a re-read of just that doc,
 * or a full rescan (folders, config, anything else). `skip` is the config list: a name matches anywhere, a path from the root.
 */
export function watchAction(rel: string, skip: string[] = DEFAULT_CONFIG.skip): "ignore" | "git" | "doc" | "index" {
  const segs = rel.split("/");
  if (segs.includes(".git") || skip.some((s) => (s.includes("/") ? rel === s || rel.startsWith(s + "/") : segs.includes(s)))) return "ignore";
  if (rel === ".synapse.json") return "index";
  if (segs.some((s) => s.startsWith("."))) return "git";
  return /\.md$/i.test(rel) ? "doc" : "index";
}
