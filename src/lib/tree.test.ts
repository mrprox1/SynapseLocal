import { describe, expect, it } from "vitest";
import { buildTree } from "./tree";

describe("buildTree", () => {
  it("nests, sorting folders first then alphabetical", () => {
    const t = buildTree(["b.md", "z/y.md", "a.md", "z/a/x.md"]);
    expect(t.map((n) => n.name)).toEqual(["z", "a.md", "b.md"]);
    expect(t[0].children!.map((n) => n.path)).toEqual(["z/a", "z/y.md"]);
    expect(t[0].children![0].children![0].path).toBe("z/a/x.md");
  });
});
