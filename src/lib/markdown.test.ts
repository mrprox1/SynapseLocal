import { describe, expect, it } from "vitest";
import { parseMarkdown, resolveLink, rewriteLinks } from "./markdown";

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
