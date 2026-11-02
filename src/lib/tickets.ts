import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString } from "mdast-util-to-string";
import { setFrontmatterKey } from "./frontmatter";

export const TICKET_FIELDS = [
  { key: "id", label: "Ticket ID" },
  { key: "summary", label: "Summary" },
  { key: "type", label: "Type" },
  { key: "component", label: "Component" },
  { key: "owner", label: "Owner" },
  { key: "reviewer", label: "Reviewer" },
  { key: "tshirt_size", label: "T-shirt Size" },
  { key: "linked_documents", label: "Linked Documents" },
  { key: "compliance_driver", label: "Compliance Driver" },
] as const;

const aliases: Record<string, string> = Object.fromEntries([
  ...TICKET_FIELDS.map(({ key, label }) => [label.toLowerCase(), key]),
  ["id", "id"], ["title", "title"], ["status", "status"],
  ["priority", "priority"], ["assignee", "assignee"],
  ["due", "due_date"], ["due date", "due_date"],
  ["linked isms documents", "linked_documents"],
]);

const parser = unified().use(remarkParse).use(remarkGfm);

export function ticketHeader(body: string) {
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
    fields[key] = key === "linked_documents" ? value.split(/\s*(?:,|;|\n)\s*/).filter(Boolean) : key === "priority" ? value.toLowerCase() : value;
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

export function normalizeTicketFields(fields: Record<string, unknown>) {
  const result = { ...fields };
  if (typeof result.priority === "string") result.priority = result.priority.toLowerCase();
  if (result.assignee === undefined && result.owner !== undefined) result.assignee = result.owner;
  if (result.id === undefined && result.ticket_id !== undefined) result.id = result.ticket_id;
  if (typeof result.linked_documents === "string") result.linked_documents = result.linked_documents.split(/\s*(?:,|;|\n)\s*/).filter(Boolean);
  return result;
}

export function setTicketField(content: string, key: string, value: string) {
  const yaml = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(content)?.[0] ?? "";
  const body = content.slice(yaml.length);
  const header = ticketHeader(body);
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
    return setFrontmatterKey(next, key, key === "linked_documents" ? value.split(/\s*(?:,|;|\n)\s*/).filter(Boolean) : value);
  }
  return next;
}

export const TICKET_TEMPLATES = {
  yaml: `---
id: TASK-001
title: Enable container image scanning
summary: Scan every container image push
status: backlog
type: Infrastructure
component: Container Security
owner: ""
reviewer: ""
priority: high
tshirt_size: S
linked_documents:
  - Secure SDLC Standard
  - Vulnerability Management Policy
compliance_driver: ISO 27001:2022 A.8.8
---

## Description

`,
  table: `# TASK-001: Enable container image scanning

| Field | Details |
| :--- | :--- |
| **Ticket ID** | TASK-001 |
| **Summary** | Scan every container image push |
| **Status** | backlog |
| **Type** | Infrastructure |
| **Component** | Container Security |
| **Owner** | |
| **Reviewer** | |
| **Priority** | High |
| **T-shirt Size** | S |
| **Linked Documents** | Secure SDLC Standard, Vulnerability Management Policy |
| **Compliance Driver** | ISO 27001:2022 A.8.8 |

---

## Description

`,
};