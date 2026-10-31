export type Comment = { date: string; author: string; text: string };

const HEADING = /^## Comments[ \t]*$/m;

/** Comments under `## Comments`, each as `### <date> · <author>` followed by its text. */
export function parseComments(content: string): Comment[] {
  const m = HEADING.exec(content);
  if (!m) return [];
  const parts = content.slice(m.index + m[0].length).split(/^### (.*)$/m); // [pre, head, text, head, text…]
  const out: Comment[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const [date, ...rest] = parts[i].trim().split(" · ");
    out.push({ date, author: rest.join(" · "), text: parts[i + 1].trim() });
  }
  return out;
}

/** Everything before the `## Comments` heading. */
export function withoutComments(text: string): string {
  const m = HEADING.exec(text);
  return m ? text.slice(0, m.index).trimEnd() : text;
}

/** Appends a comment at the very end of the file, creating `## Comments` if missing. */
export function addComment(content: string, author: string, text: string, date: string): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const head = HEADING.test(content) ? "" : `${eol}${eol}## Comments`;
  return `${content.replace(/\s+$/, "")}${head}${eol}${eol}### ${date} · ${author}${eol}${eol}${text.trim()}${eol}`;
}
