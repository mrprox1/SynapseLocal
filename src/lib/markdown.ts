import { parse } from "yaml";

export type ParsedMarkdown = {
  title: string;
  frontmatter: Record<string, unknown>;
  body: string;
  links: string[];
};

const FM = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const FENCE = /^(```|~~~)[\s\S]*?(?:^\1.*$|(?![\s\S]))/gm;
const LINK = /\[\[([^\][|]+)(?:\|[^\]]*)?\]\]/g;

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

  const fmTitle = frontmatter.title;
  const heading = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(body.replace(FENCE, ""))?.[1];
  const file = path.split(/[\\/]/).pop()!.replace(/\.md$/i, "");
  const title = (typeof fmTitle === "string" && fmTitle.trim()) || heading || file;

  const links = [...body.replace(FENCE, "").matchAll(LINK)]
    .map((l) => l[1].trim())
    .filter(Boolean);
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
