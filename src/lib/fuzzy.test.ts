import { describe, expect, it } from "vitest";
import { fuzzyScore } from "./fuzzy";

describe("fuzzyScore", () => {
  it("returns null without a subsequence match", () => {
    expect(fuzzyScore("xyz", "kanban-spec.md")).toBeNull();
  });
  it("matches ksp against kanban-spec.md", () => {
    expect(fuzzyScore("ksp", "kanban-spec.md")).not.toBeNull();
  });
  it("ranks consecutive above scattered", () => {
    expect(fuzzyScore("spec", "spec")!).toBeGreaterThan(fuzzyScore("spec", "sxpxexc")!);
  });
  it("ranks word start above mid-word", () => {
    expect(fuzzyScore("b", "a-b")!).toBeGreaterThan(fuzzyScore("b", "ab")!);
  });
});
