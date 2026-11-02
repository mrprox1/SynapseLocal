import { describe, expect, it } from "vitest";
import { parseMarkdown, resolveLink, rewriteLinks } from "./markdown";
import { addLink, DEFAULT_TICKET_FIELDS, removeLink, setTicketField, ticketTemplate, type TicketField } from "./tickets";

// the hard-coded templates from before they were generated
const OLD_TEMPLATES = {
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

const TICKET_TEMPLATES = { yaml: ticketTemplate("yaml", DEFAULT_TICKET_FIELDS), table: ticketTemplate("table", DEFAULT_TICKET_FIELDS) };

describe("parseMarkdown", () => {
  it("title: frontmatter > heading > filename", () => {
    expect(parseMarkdown("a/x.md", "---\ntitle: FM\n---\n# H\n").title).toBe("FM");
    expect(parseMarkdown("a/x.md", "# H\ntext").title).toBe("H");
    expect(parseMarkdown("a\\x.md", "text").title).toBe("x");
  });
  it("no or invalid frontmatter gives {}", () => {
    expect(parseMarkdown("x.md", "hi").frontmatter).toEqual({});
    expect(parseMarkdown("x.md", "---\na: [\n---\nhi").frontmatter).toEqual({});
  });
  it("handles CRLF and returns body after frontmatter", () => {
    const r = parseMarkdown("x.md", "---\r\nstatus: todo\r\n---\r\n# T\r\nbody");
    expect(r.frontmatter).toEqual({ status: "todo" });
    expect(r.body).toBe("# T\r\nbody");
    expect(r.title).toBe("T");
  });
  it("extracts targets, strips aliases, dedupes", () => {
    expect(parseMarkdown("x.md", "[[A]] [[ B |alias]] [[A]]").links).toEqual(["A", "B"]);
  });
  it("ignores links and headings in code fences", () => {
    const r = parseMarkdown("x.md", "```\n# no\n[[Nope]]\n```\n[[Yes]]");
    expect(r.links).toEqual(["Yes"]);
    expect(r.title).toBe("x");
  });
  it("reads a ticket table with an arbitrary ID and keeps only notes in the body", () => {
    const content = "# SEC/032: Enable scanning\n\n| Field | Details |\n| :--- | :--- |\n| **Ticket ID** | SEC/032 |\n| **Summary** | Scan every push |\n| **Type** | Infrastructure |\n| **Component** | Security |\n| **Owner** | Markus |\n| **Reviewer** | Daniel |\n| **Priority** | High |\n| **T-shirt Size** | S |\n| **Linked Documents** | Policy, Standard |\n| **Compliance Driver** | ISO 27001 |\n\n---\n\nNotes [[Policy]].\n";
    const result = parseMarkdown("tickets/security/scanning.md", content);
    expect(result.title).toBe("Enable scanning");
    expect(result.frontmatter).toMatchObject({ id: "SEC/032", title: "Enable scanning", summary: "Scan every push", type: "Infrastructure", component: "Security", owner: "Markus", assignee: "Markus", reviewer: "Daniel", priority: "high", tshirt_size: "S", linked_documents: ["Policy", "Standard"], compliance_driver: "ISO 27001" });
    expect(result.body).toBe("Notes [[Policy]].\n");
    expect(result.links).toContain("Policy");
    expect(content.slice(0, content.length - result.body.length) + "Updated notes").toContain("**Ticket ID** | SEC/032");
  });
  it("lets explicit YAML override table fields, including empty values", () => {
    const result = parseMarkdown("tickets/a.md", '---\ntitle: Override\npriority: low\nowner: ""\n---\n# OPS-1: Original\n\n| Field | Details |\n| --- | --- |\n| Ticket ID | OPS-1 |\n| Owner | Markus |\n| Priority | High |\n');
    expect(result.title).toBe("Override");
    expect(result.frontmatter).toMatchObject({ id: "OPS-1", owner: "", assignee: "", priority: "low" });
    expect(result.body).toBe("");
  });
});

describe("link list helpers", () => {
  it("adds without duplicates and removes by index", () => {
    expect(addLink(["A"], "B")).toEqual(["A", "B"]);
    expect(addLink(["A"], "a")).toEqual(["A"]);
    expect(removeLink(["A", "B", "C"], 1)).toEqual(["A", "C"]);
  });
});

describe("configurable ticket fields", () => {
  it("generates exactly the old templates for the default fields", () => {
    expect(TICKET_TEMPLATES).toEqual(OLD_TEMPLATES);
  });
  const fields: TicketField[] = [{ key: "id", label: "Ticket ID" }, { key: "sprint", label: "Sprint" }, { key: "refs", label: "Refs", type: "links" }];
  it.each(["yaml", "table"] as const)("round trips a custom text and links field in the %s layout", (layout) => {
    let content = ticketTemplate(layout, fields);
    expect(parseMarkdown("t.md", content, fields).frontmatter).toMatchObject({ id: "TASK-001", refs: ["Secure SDLC Standard", "Vulnerability Management Policy"] });
    content = setTicketField(content, "sprint", "S7", fields);
    content = setTicketField(content, "refs", "A, B", fields);
    const r = parseMarkdown("t.md", content, fields);
    expect(r.frontmatter).toMatchObject({ sprint: "S7", refs: ["A", "B"] });
    expect(r.links).toEqual(["A", "B"]);
  });
  it("only reads configured fields", () => {
    const table = "# A\n\n| Field | Details |\n| --- | --- |\n| Sprint | 3 |\n| Ticket ID | X |";
    expect(parseMarkdown("t.md", table, fields).frontmatter.sprint).toBe("3");
    expect(parseMarkdown("t.md", table).frontmatter.sprint).toBeUndefined();
  });
});

describe("ticket header editing", () => {
  it.each(["yaml", "table"] as const)("round trips the %s template and all field edits", (layout) => {
    let content = TICKET_TEMPLATES[layout];
    expect(parseMarkdown("ticket.md", content).frontmatter.linked_documents).toEqual(["Secure SDLC Standard", "Vulnerability Management Policy"]);
    for (const [key, value] of Object.entries({ id: "CUSTOM/42", title: "A different title", summary: "Summary | with *formatting*", owner: "Alex", reviewer: "Sam", priority: "low", status: "done", tshirt_size: "XL", type: "Task", component: "API", compliance_driver: "ISO", linked_documents: "Policy, Standard" })) {
      content = setTicketField(content, key, value);
      const expected = key === "linked_documents" ? ["Policy", "Standard"] : value;
      expect(parseMarkdown("ticket.md", content).frontmatter[key]).toEqual(expected);
    }
    const result = parseMarkdown("ticket.md", content);
    expect(result.title).toBe("A different title");
    expect(result.body).toBe(layout === "yaml" ? "\n## Description\n\n" : "## Description\n\n");
    expect(result.links).toEqual(["Policy", "Standard"]);
    if (layout === "table") expect(content).toContain("# CUSTOM/42: A different title");
    content = setTicketField(content, "linked_documents", "");
    expect(parseMarkdown("ticket.md", content).frontmatter.linked_documents).toEqual([]);
    content = setTicketField(content, "owner", "");
    expect(parseMarkdown("ticket.md", content).frontmatter.assignee).toBe("");
  });
  it("keeps metadata wiki links and accepts the legacy document label", () => {
    const content = "# A\n\n| Field | Details |\n| --- | --- |\n| Linked ISMS Documents | [[Policy]], [[Standard]] |\n\n---\n\nNotes";
    const result = parseMarkdown("a.md", content);
    expect(result.frontmatter.linked_documents).toEqual(["[[Policy]]", "[[Standard]]"]);
    expect(result.links).toEqual(["Policy", "Standard"]);
    expect(result.body).toBe("Notes");
  });
  it("keeps CRLF and unrelated table content when editing", () => {
    const content = TICKET_TEMPLATES.table.replace(/\n/g, "\r\n");
    const updated = setTicketField(content, "priority", "low");
    expect(updated).toContain("| **Priority** | low |");
    expect(updated.replace("| **Priority** | low |", "| **Priority** | High |")).toBe(content);
  });
});

describe("resolveLink", () => {
  const files = [
    { path: "b/Foo.md", title: "Other" },
    { path: "a/foo.md", title: "Bar" },
    { path: "c/z.md", title: "Baz" },
  ];
  it("filename first, ambiguity by path", () => {
    expect(resolveLink("FOO", files)?.path).toBe("a/foo.md");
  });
  it("falls back to title, then null", () => {
    expect(resolveLink("baz", files)?.path).toBe("c/z.md");
    expect(resolveLink("nope", files)).toBeNull();
  });
});

describe("rewriteLinks", () => {
  it("renames matching links, keeps aliases, skips fences and other links", () => {
    const src = "[[Old]] [[old|al]] [[Other]]\n```\n[[Old]]\n```\n[[ OLD ]]";
    const r = rewriteLinks(src, (t) => t.toLowerCase() === "old", "New");
    expect(r.n).toBe(3);
    expect(r.content).toBe("[[New]] [[New|al]] [[Other]]\n```\n[[Old]]\n```\n[[New]]");
  });
});
