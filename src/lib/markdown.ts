import { parse } from "yaml";
import { normalizeTicketFields, ticketHeader } from "./tickets";

export type ParsedMarkdown = {
  title: string;
  frontmatter: Record<string, unknown>;
  body: string;
  links: string[];
};

const FM = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const FENCE = /^(```|~~~)[\s\S]*?(?:^\1.*$|(?![\s\S]))/gm;
const LINK = /\[\[([^\][|]+)(?:\|[^\]]*)?\]\]/g;
const LINK_ALIAS = /\[\[([^\][|]+)(\|[^\]]*)?\]\]/g;

export function parseMarkdown(path: string, content: string): ParsedMarkdown {
  let frontmatter: Record<string, unknown> = {};
  let body = content;
  const m = FM.exec(content);
  if (m) {
    body = content.slice(m[0].length);
    try {
      const y = parse(m[1]);
      if (y && typeof y === "object" && !Array.isArray(y)) frontmatter = y;
    } catch {
      // invalid YAML: treat as no frontmatter
    }
  }

  const linkBody = body;
  const header = ticketHeader(body);
  if (header) {
    frontmatter = { ...header.fields, ...frontmatter };
    body = header.body;
  }
  frontmatter = normalizeTicketFields(frontmatter);
  const fmTitle = frontmatter.title;
  const heading = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(body.replace(FENCE, ""))?.[1];
  const file = path.split(/[\\/]/).pop()!.replace(/\.md$/i, "");
  const title = (typeof fmTitle === "string" && fmTitle.trim()) || heading || file;

  const links = [...linkBody.replace(FENCE, "").matchAll(LINK)]
    .map((l) => l[1].trim())
    .filter(Boolean);
  if (Array.isArray(frontmatter.linked_documents))
    links.push(...frontmatter.linked_documents.filter((value): value is string => typeof value === "string").map((value) => value.replace(/^\[\[|\]\]$/g, "")));
  return { title, frontmatter, body, links: [...new Set(links)] };
}

const stem = (p: string) => p.split(/[\\/]/).pop()!.replace(/\.md$/i, "").toLowerCase();

/** Filename match first, then title match; ambiguous → first by path. */
export function resolveLink<T extends { path: string; title: string }>(
  target: string,
  files: T[],
): T | null {
  const t = target.trim().toLowerCase();
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  return (
    sorted.find((f) => stem(f.path) === t) ??
    sorted.find((f) => f.title.toLowerCase() === t) ??
    null
  );
}

/** Rewrite `[[t]]` / `[[t|alias]]` to point at `to` where `match(t)`; fences untouched. Returns the count. */
export function rewriteLinks(content: string, match: (target: string) => boolean, to: string) {
  let n = 0;
  const fix = (s: string) =>
    s.replace(LINK_ALIAS, (m, t: string, alias?: string) => {
      if (!match(t.trim())) return m;
      n++;
      return `[[${to}${alias ?? ""}]]`;
    });
  let out = "";
  let last = 0;
  for (const f of content.matchAll(FENCE)) {
    out += fix(content.slice(last, f.index)) + f[0];
    last = f.index + f[0].length;
  }
  return { content: out + fix(content.slice(last)), n };
}
