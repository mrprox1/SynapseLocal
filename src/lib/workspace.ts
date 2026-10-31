export type Config = { docsDir: string; ticketsDir: string };
export type Category = "doc" | "ticket" | "other";

export const DEFAULT_CONFIG: Config = { docsDir: "docs", ticketsDir: "tickets" };

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
    };
  } catch {
    console.warn(".synapse.json is not valid JSON; using defaults");
    return DEFAULT_CONFIG;
  }
}

/** `rel` is root-relative with forward slashes. When one folder is inside the other (e.g. `docs/tasks`), the deeper one wins. */
export function categorize(rel: string, c: Config): Category {
  const inDocs = rel.startsWith(c.docsDir + "/");
  const inTickets = rel.startsWith(c.ticketsDir + "/");
  if (inDocs && inTickets) return c.ticketsDir.length > c.docsDir.length ? "ticket" : "doc";
  return inDocs ? "doc" : inTickets ? "ticket" : "other";
}

/** Strip characters that are illegal in Windows filenames (and path separators). */
export const sanitizeName = (name: string) => name.replace(/[\\/:*?"<>|]/g, "").trim();
