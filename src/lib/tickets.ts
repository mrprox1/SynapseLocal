import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString } from "mdast-util-to-string";
import { setFrontmatterKey } from "./frontmatter";

export type TicketField = { key: string; label: string; type?: "text" | "links" };

export const DEFAULT_TICKET_FIELDS: TicketField[] = [
  { key: "id", label: "Ticket ID" },
  { key: "summary", label: "Summary" },
  { key: "type", label: "Type" },
  { key: "component", label: "Component" },
  { key: "owner", label: "Owner" },
  { key: "reviewer", label: "Reviewer" },
  { key: "tshirt_size", label: "T-shirt Size" },
  { key: "linked_documents", label: "Linked Documents", type: "links" },
  { key: "compliance_driver", label: "Compliance Driver" },
];

/** Board fields that always exist; a configured field can't reuse their keys. */
export const BUILTIN_KEYS = ["title", "status", "priority", "assignee", "due_date"];

/** YAML key for a new field's label ("Risk Owner" → "risk_owner"). */
export const fieldKey = (label: string) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Keeps entries with a label and a free, unique key; null when `v` isn't an array. */
export function cleanTicketFields(v: unknown): TicketField[] | null {
  if (!Array.isArray(v)) return null;
  const seen = new Set(BUILTIN_KEYS);
  const out: TicketField[] = [];
  for (const f of v) {
    const label = typeof f?.label === "string" ? f.label.trim() : "";
    const key = typeof f?.key === "string" && f.key.trim() ? fieldKey(f.key) : fieldKey(label);
    if (!label || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(f.type === "links" ? { key, label, type: "links" } : { key, label });
  }
  return out;
}

const listOf = (value: string) => value.split(/\s*(?:,|;|\n)\s*/).filter(Boolean);
const isLinks = (fields: TicketField[], key: string) => fields.some((f) => f.key === key && f.type === "links");

/** Add `name` unless already linked (case-insensitive). */
export const addLink = (list: string[], name: string) => (list.some((l) => l.toLowerCase() === name.toLowerCase()) ? list : [...list, name]);
export const removeLink = (list: string[], i: number) => list.filter((_, j) => j !== i);

const aliasesFor = (fields: TicketField[]): Record<string, string> => Object.fromEntries([
  ...fields.flatMap(({ key, label }) => [[label.toLowerCase(), key], [key, key]]),
  ["id", "id"], ["title", "title"], ["status", "status"],
  ["priority", "priority"], ["assignee", "assignee"],
  ["due", "due_date"], ["due date", "due_date"],
  ["linked isms documents", "linked_documents"],
]);

const parser = unified().use(remarkParse).use(remarkGfm);

export function ticketHeader(body: string, ticketFields = DEFAULT_TICKET_FIELDS) {
  const aliases = aliasesFor(ticketFields);
  const tree = parser.parse(body);
  const heading = tree.children[0]?.type === "heading" && tree.children[0].depth === 1 ? tree.children[0] : undefined;
  const table = tree.children[heading ? 1 : 0];
  if (table?.type !== "table") return null;
  const labels = table.children[0]?.children.map((cell) => toString(cell).trim().toLowerCase());
  if (labels?.[0] !== "field" || !["details", "value"].includes(labels[1])) return null;
  const fields: Record<string, unknown> = {};
  const cells = new Map<string, { start: number; end: number }>();
  for (const row of table.children.slice(1)) {
    const key = aliases[toString(row.children[0]).trim().toLowerCase()];
    const cell = row.children[1];
    if (!key || !cell) continue;
    const value = toString(cell).trim();
    fields[key] = isLinks(ticketFields, key) ? listOf(value) : key === "priority" ? value.toLowerCase() : value;
    if (cell.position) cells.set(key, { start: cell.position.start.offset!, end: cell.position.end.offset! });
  }
  if (!Object.keys(fields).length) return null;
  const headingText = heading ? toString(heading) : "";
  const id = typeof fields.id === "string" ? fields.id : "";
  fields.title = fields.title || (id && headingText.startsWith(`${id}:`) ? headingText.slice(id.length + 1).trim() : headingText) || fields.summary;
  const divider = tree.children[(heading ? 1 : 0) + 1];
  const end = divider?.type === "thematicBreak" ? divider.position!.end.offset! : table.position!.end.offset!;
  return { fields, cells, heading, body: body.slice(end).replace(/^(?:[ \t]*\r?\n)+/, "") };
}

export function normalizeTicketFields(fields: Record<string, unknown>, ticketFields = DEFAULT_TICKET_FIELDS) {
  const result = { ...fields };
  if (typeof result.priority === "string") result.priority = result.priority.toLowerCase();
  if (result.assignee === undefined && result.owner !== undefined) result.assignee = result.owner;
  if (result.id === undefined && result.ticket_id !== undefined) result.id = result.ticket_id;
  for (const f of ticketFields) if (f.type === "links" && typeof result[f.key] === "string") result[f.key] = listOf(result[f.key] as string);
  return result;
}

export function setTicketField(content: string, key: string, value: string, ticketFields = DEFAULT_TICKET_FIELDS) {
  const yaml = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(content)?.[0] ?? "";
  const body = content.slice(yaml.length);
  const header = ticketHeader(body, ticketFields);
  const cell = header?.cells.get(key);
  const yamlOwnsKey = new RegExp(`^${key}:`, "m").test(yaml);
  let next = content;
  if (cell) {
    const escaped = value.replace(/\\/g, "\\\\").replace(/([|*_[\]`<>])/g, "\\$1");
    const original = body.slice(cell.start, cell.end);
    next = yaml + body.slice(0, cell.start) + `${original.startsWith("|") ? "|" : ""} ${escaped} ${original.endsWith("|") ? "|" : ""}` + body.slice(cell.end);
  }
  if (header?.heading && (key === "title" || key === "id")) {
    const currentBody = next.slice(yaml.length);
    const id = key === "id" ? value : String(header.fields.id ?? "");
    const title = key === "title" ? value : String(header.fields.title ?? "");
    next = yaml + currentBody.slice(0, header.heading.position!.start.offset!) + `# ${id ? `${id}: ` : ""}${title}` + currentBody.slice(header.heading.position!.end.offset!);
  }
  if (yamlOwnsKey || (!cell && !(header?.heading && key === "title"))) {
    return setFrontmatterKey(next, key, isLinks(ticketFields, key) ? listOf(value) : value);
  }
  return next;
}

const SAMPLE: Record<string, string> = {
  id: "TASK-001", summary: "Scan every container image push", type: "Infrastructure", component: "Container Security",
  tshirt_size: "S", compliance_driver: "ISO 27001:2022 A.8.8",
};
const SAMPLE_LINKS = ["Secure SDLC Standard", "Vulnerability Management Policy"];
const TITLE = "Enable container image scanning";

/** Header text for the Settings copy button, generated from the configured fields. */
export function ticketTemplate(layout: "yaml" | "table", fields: TicketField[]) {
  // status / priority sit at fixed spots among the configured fields
  const hasId = fields.some((f) => f.key === "id");
  if (layout === "yaml") {
    const lines = fields.map(({ key, type }) =>
      type === "links" ? `${key}:\n${SAMPLE_LINKS.map((l) => `  - ${l}`).join("\n")}` : `${key}: ${SAMPLE[key] ?? '""'}`);
    lines.splice(Math.min(1, lines.length), 0, `title: ${TITLE}`);
    lines.splice(Math.min(3, lines.length), 0, "status: backlog");
    lines.splice(Math.min(8, lines.length), 0, "priority: high");
    return `---\n${lines.join("\n")}\n---\n\n## Description\n\n`;
  }
  const rows = fields.map(({ key, label, type }) => `| **${label}** | ${type === "links" ? SAMPLE_LINKS.join(", ") : SAMPLE[key] ?? ""} |`.replace("|  |", "| |"));
  rows.splice(Math.min(2, rows.length), 0, "| **Status** | backlog |");
  rows.splice(Math.min(7, rows.length), 0, "| **Priority** | High |");
  return `# ${hasId ? `${SAMPLE.id}: ` : ""}${TITLE}\n\n| Field | Details |\n| :--- | :--- |\n${rows.join("\n")}\n\n---\n\n## Description\n\n`;
}
