import { describe, expect, it, vi } from "vitest";
import { categorize, DEFAULT_CONFIG, parseConfig, relativeTo, sanitizeName, validateDir, watchAction } from "./workspace";

describe("parseConfig", () => {
  it("defaults when missing, partial, or invalid", () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(parseConfig('{"docsDir":"wiki/"}')).toEqual({ ...DEFAULT_CONFIG, docsDir: "wiki" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseConfig("{nope")).toEqual(DEFAULT_CONFIG);
  });
});

describe("categorize", () => {
  const c = parseConfig('{"docsDir":"wiki"}');
  it("uses configured dirs", () => {
    expect(categorize("wiki/a.md", c)).toBe("doc");
    expect(categorize("tickets/t.md", c)).toBe("ticket");
    expect(categorize("docs/a.md", c)).toBe("other");
    expect(categorize("wikipedia/a.md", c)).toBe("other");
  });
  it("treats tickets in arbitrarily deep subfolders like root tickets", () => {
    expect(categorize("tickets/security/aws/JIRA-032.md", c)).toBe("ticket");
    expect(categorize("tickets/archive/security/JIRA-032.md", c)).toBe("ticket");
    expect(categorize("tickets-other/security/JIRA-032.md", c)).toBe("other");
  });
  it("nested folder wins", () => {
    const n = parseConfig('{"ticketsDir":"docs/tasks"}');
    expect(categorize("docs/tasks/t.md", n)).toBe("ticket");
    expect(categorize("docs/a.md", n)).toBe("doc");
    const r = parseConfig('{"docsDir":"tickets/notes"}');
    expect(categorize("tickets/notes/a.md", r)).toBe("doc");
    expect(categorize("tickets/t.md", r)).toBe("ticket");
  });
});

describe("sanitizeName", () => {
  it("strips illegal chars", () => {
    expect(sanitizeName(' a/b\c:d*e?"f<g>h|i ')).toBe("abcdefghi");
  });
});

describe("validateDir", () => {
  it("accepts inside, nested and not-yet-existing folders", () => {
    expect(validateDir("wiki", "tickets")).toBeNull();
    expect(validateDir("docs/tasks/", "docs")).toBeNull();
    expect(validateDir(["docs", "tasks"].join(String.fromCharCode(92)), "docs")).toBeNull();
  });
  it("refuses empty, outside, `..` and same-as-other", () => {
    expect(validateDir("  ", "x")).not.toBeNull();
    expect(validateDir("/etc", "x")).not.toBeNull();
    expect(validateDir("C:/x", "x")).not.toBeNull();
    expect(validateDir("../x", "y")).not.toBeNull();
    expect(validateDir("a/../b", "y")).not.toBeNull();
    expect(validateDir("docs/", "docs")).not.toBeNull();
  });
});

describe("relativeTo", () => {
  it("only accepts paths under root", () => {
    expect(relativeTo("C:/w", "C:/w/docs/")).toBe("docs");
    expect(relativeTo("C:/w", "C:/w")).toBeNull();
    expect(relativeTo("C:/w", "C:/other")).toBeNull();
  });
});

describe("parseConfig ticketFields", () => {
  const f = (v: unknown) => parseConfig(JSON.stringify({ ticketFields: v })).ticketFields;
  it("defaults when missing or not a list", () => {
    expect(f(undefined)).toEqual(DEFAULT_CONFIG.ticketFields);
    expect(f("x")).toEqual(DEFAULT_CONFIG.ticketFields);
  });
  it("cleans entries", () => {
    expect(f([{ label: "Risk Owner" }, { key: "x", label: "" }, { label: "Risk owner" }, { label: "Status" }, { key: "refs", label: "Refs", type: "links" }, 3])).toEqual([
      { key: "risk_owner", label: "Risk Owner" },
      { key: "refs", label: "Refs", type: "links" },
    ]);
    expect(f([])).toEqual([]);
  });
});

describe("watchAction", () => {
  it("routes paths by what the index needs", () => {
    expect(watchAction(".git/index.lock")).toBe("ignore");
    expect(watchAction("web/node_modules/x/README.md")).toBe("ignore");
    expect(watchAction(".synapse.json")).toBe("index");
    expect(watchAction(".claude/notes.md")).toBe("git");
    expect(watchAction("docs/.draft.md")).toBe("git");
    expect(watchAction("docs/A.MD")).toBe("doc");
    expect(watchAction("docs")).toBe("index");
    expect(watchAction("src/main.ts")).toBe("index");
  });
});
