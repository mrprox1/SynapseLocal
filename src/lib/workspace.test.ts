import { describe, expect, it, vi } from "vitest";
import { categorize, DEFAULT_CONFIG, parseConfig, relativeTo, sanitizeName, validateDir } from "./workspace";

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
