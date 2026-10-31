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

/** `rel` is root-relative with forward slashes. */
export function categorize(rel: string, c: Config): Category {
  if (rel.startsWith(c.docsDir + "/")) return "doc";
  if (rel.startsWith(c.ticketsDir + "/")) return "ticket";
  return "other";
}
