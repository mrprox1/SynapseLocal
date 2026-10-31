import { describe, expect, it, vi } from "vitest";
import { categorize, DEFAULT_CONFIG, parseConfig, sanitizeName } from "./workspace";

describe("parseConfig", () => {
  it("defaults when missing, partial, or invalid", () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(parseConfig('{"docsDir":"wiki/"}')).toEqual({ docsDir: "wiki", ticketsDir: "tickets" });
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
