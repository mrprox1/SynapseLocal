import { describe, expect, it } from "vitest";
import { placeCard, slugify, sortCards, subtasks, ticketStatus, uniquePath } from "./board";

describe("board", () => {
  it("status is strict, default backlog", () => {
    expect(ticketStatus({ status: "in-progress" })).toBe("in-progress");
    expect(ticketStatus({ status: "In Progress" })).toBe("backlog");
    expect(ticketStatus({})).toBe("backlog");
  });

  it("counts sub-tasks", () => {
    expect(subtasks("- [ ] a\n- [x] b\n  * [X] c\ntext [ ]")).toEqual({ done: 2, total: 3 });
  });

  it("sorts ordered first, then by filename", () => {
    const c = [{ path: "b" }, { path: "a" }, { path: "z", order: 2 }, { path: "y", order: 1 }];
    expect(sortCards(c).map((x) => x.path)).toEqual(["y", "z", "a", "b"]);
  });

  it("placeCard writes only the moved card when neighbours are ordered", () => {
    const l = [{ path: "a", order: 1 }, { path: "b", order: 2 }];
    expect(placeCard(l, "x", 1)).toEqual({ x: 1.5 });
    expect(placeCard(l, "x", 0)).toEqual({ x: 0 });
    expect(placeCard(l, "x", 2)).toEqual({ x: 3 });
    expect(placeCard([], "x", 0)).toEqual({ x: 1 });
    expect(placeCard([{ path: "a" }], "x", 0)).toEqual({ x: 1 });
  });

  it("placeCard renumbers when the previous card has no order", () => {
    expect(placeCard([{ path: "a" }, { path: "b" }], "x", 1)).toEqual({ a: 1, x: 2, b: 3 });
  });

  it("slugs and collisions", () => {
    expect(slugify("Fix login bug!")).toBe("fix-login-bug");
    expect(slugify("???")).toBe("ticket");
    expect(uniquePath("t", "a", ["t/a.md", "t/a-2.md"])).toBe("t/a-3.md");
    expect(uniquePath("t", "a", [])).toBe("t/a.md");
  });
});
