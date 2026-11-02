import { isNode, parseDocument } from "yaml";

// Line-based edits of top-level frontmatter keys; everything else stays byte-identical.
// shortcut: scalar values only, a key owning a nested block would leave its children behind.

// [1]=eol after opening ---, [2]=block lines (each with its eol) or undefined when empty
const FM = /^---(\r?\n)([\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/;
const EOL = /\r?\n/;

const keyLine = (key: string, flags = "m") =>
  new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:.*(?:\\r?\\n|$)`, flags);

const SCALAR = /^\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^#]*?)(\s+#.*)?\s*$/;

function fmt(value: string | number | string[]) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "number") return String(value);
  const s = value;
  return s === "" || /[:#]|^\s|\s$|^[-?[\]{}&*!|>'"%@`]|\n/.test(s) ? JSON.stringify(s) : s;
}

export function setFrontmatterKey(content: string, key: string, value: string | number | string[]): string {
  const eol = EOL.exec(content)?.[0] ?? "\n";
  const m = FM.exec(content);
  if (!m) return `---${eol}${key}: ${fmt(value)}${eol}---${eol}${content}`;

  const block = m[2] ?? "";
  const re = keyLine(key);
  let newBlock: string;
  if (re.test(block)) {
    const node = Array.isArray(value) ? parseDocument(block).get(key, true) : undefined;
    if (isNode(node) && node.range) {
      const start = re.exec(block)!.index;
      newBlock = block.slice(0, start) + `${key}: ${fmt(value)}${eol}` + block.slice(node.range[2]);
    } else newBlock = block.replace(re, (line) => {
      const rest = line.slice(key.length + 1).replace(/\r?\n$/, "");
      const comment = SCALAR.exec(rest)?.[1] ?? "";
      return `${key}: ${fmt(value)}${comment}${line.slice(line.replace(/\r?\n$/, "").length)}`;
    });
  } else {
    newBlock = `${block}${key}: ${fmt(value)}${m[1]}`;
  }
  const closing = 3 + m[1].length + block.length;
  return `---${m[1]}${newBlock}${content.slice(closing)}`;
}

/** Drops the `key:` line if present. */
export function removeFrontmatterKey(content: string, key: string): string {
  const m = FM.exec(content);
  if (!m?.[2]) return content;
  const closing = 3 + m[1].length + m[2].length;
  return `---${m[1]}${m[2].replace(keyLine(key), "")}${content.slice(closing)}`;
}
