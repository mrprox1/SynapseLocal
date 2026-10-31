import { describe, expect, it } from "vitest";
import { parseStatus } from "./git";

const z = (...r: string[]) => r.join("\0") + "\0";

describe("parseStatus", () => {
  it("maps codes and reads the branch", () => {
    const s = parseStatus("", z("## main...origin/main", " M a.md", "A  b.md", " D c.md", "?? d/e.md", "MM f.md"));
    expect(s.branch).toBe("main");
    expect(s.files).toEqual({ "a.md": "M", "b.md": "A", "c.md": "D", "d/e.md": "U", "f.md": "M" });
  });
  it("treats a rename as added and skips the old path", () => {
    const s = parseStatus("", z("## main", "R  new.md", "old.md", " M x.md"));
    expect(s.files).toEqual({ "new.md": "A", "x.md": "M" });
  });
  it("strips the subfolder prefix and ignores paths outside it", () => {
    const s = parseStatus("sub/", z("## No commits yet on dev", "?? sub/a.md", " M other.md"));
    expect(s).toEqual({ branch: "dev", files: { "a.md": "U" } });
  });
});
