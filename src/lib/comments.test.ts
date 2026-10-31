import { describe, expect, it } from "vitest";
import { addComment, parseComments, withoutComments } from "./comments";

describe("comments", () => {
  it("creates the section, then appends under it", () => {
    const a = addComment("---\ntitle: T\n---\nbody\n", "dbw", "first", "2026-06-01 10:00");
    expect(a).toBe("---\ntitle: T\n---\nbody\n\n## Comments\n\n### 2026-06-01 10:00 · dbw\n\nfirst\n");
    const b = addComment(a, "ann", "second\nline", "2026-06-02 09:30");
    expect(b.match(/## Comments/g)).toHaveLength(1);
    expect(parseComments(b)).toEqual([
      { date: "2026-06-01 10:00", author: "dbw", text: "first" },
      { date: "2026-06-02 09:30", author: "ann", text: "second\nline" },
    ]);
  });
  it("strips the section", () => {
    expect(withoutComments("body\n\n## Comments\n\n### d · a\n\nx\n")).toBe("body");
    expect(withoutComments("body\n")).toBe("body\n");
  });
  it("no section, no comments; keeps CRLF", () => {
    expect(parseComments("# x\n")).toEqual([]);
    expect(addComment("a\r\n", "x", "y", "d")).toBe("a\r\n\r\n## Comments\r\n\r\n### d · x\r\n\r\ny\r\n");
  });
});
