import { describe, expect, it } from "vitest";
import { search } from "./search";
import type { FileEntry } from "@/store/workspace";

const f = (path: string, category: string, content: string, title = path): FileEntry =>
  ({ path, category, content, title }) as unknown as FileEntry;

describe("search", () => {
  const files = [
    f("a.md", "doc", "Alpha beta\ngamma"),
    f("t/b.md", "ticket", "priority: high\nbeta only here"),
    f("t/archive/c.md", "ticket", "beta alpha"),
  ];
  it("ANDs words, case-insensitively", () => {
    expect(search(files, "ALPHA beta", "all").map((r) => r.path).sort()).toEqual(["a.md", "t/archive/c.md"]);
  });
  it("matches quoted phrases exactly", () => {
    expect(search(files, '"alpha beta"', "all").map((r) => r.path)).toEqual(["a.md"]);
    expect(search(files, '"priority: high"', "all")).toHaveLength(1);
  });
  it("filters by scope and labels archived", () => {
    expect(search(files, "beta", "doc").map((r) => r.path)).toEqual(["a.md"]);
    const t = search(files, "beta", "ticket", "t");
    expect(t.find((r) => r.path === "t/archive/c.md")?.archived).toBe(true);
    expect(t.find((r) => r.path === "t/b.md")?.archived).toBeUndefined();
  });
  it("gives line offsets into content", () => {
    const r = search(files, "gamma", "all")[0].lines[0];
    expect(files[0].content.slice(r.from, r.to).toLowerCase()).toBe("gamma");
    expect(r.line).toBe(2);
  });
  it("ranks title hits first, caps lines at 3 and files at 100", () => {
    const many = Array.from({ length: 120 }, (_, i) => f(`${i}.md`, "doc", "x\nx\nx\nx\nx", i === 119 ? "x" : "n"));
    const r = search(many, "x", "all");
    expect(r).toHaveLength(100);
    expect(r[0].path).toBe("119.md");
    expect(r[0].lines).toHaveLength(3);
  });
});
