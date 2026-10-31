import { describe, expect, it } from "vitest";
import { archivePath, isArchived, matchesFilter, restorePath, placeCard, slugify, sortCards, subtasks, dueLabel, dueNear, groupArchived, dueState, ticketDue, ticketStatus, uniquePath } from "./board";

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

  it("filters combine with AND", () => {
    const f = { priorities: ["high", "none"], assignee: "ann" };
    expect(matchesFilter({ priority: "high", assignee: "ann" }, f)).toBe(true);
    expect(matchesFilter({ assignee: "ann" }, f)).toBe(true);
    expect(matchesFilter({ priority: "low", assignee: "ann" }, f)).toBe(false);
    expect(matchesFilter({ priority: "high", assignee: "bob" }, f)).toBe(false);
    expect(matchesFilter({ priority: "high" }, { priorities: [], assignee: "__none" })).toBe(true);
  });
});

describe("archive", () => {
  it("is detected by location only", () => {
    expect(isArchived("tickets/archive/x.md", "tickets")).toBe(true);
    expect(isArchived("tickets/x.md", "tickets")).toBe(false);
    expect(isArchived("tickets/archive-notes/x.md", "tickets")).toBe(false);
  });
  it("moves keep the filename", () => {
    expect(archivePath("tickets/x.md", "tickets")).toBe("tickets/archive/x.md");
    expect(restorePath("tickets/archive/x.md", "tickets")).toBe("tickets/x.md");
  });

  it("due dates", () => {
    expect(ticketDue({ due_date: "2026-06-01" })).toBe("2026-06-01");
    expect(ticketDue({ due_date: new Date("2026-06-01") })).toBe("2026-06-01");
    expect(ticketDue({ due_date: "soon" })).toBeUndefined();
    expect(dueState("2026-05-31", "todo", "2026-06-01")).toBe("overdue");
    expect(dueState("2026-06-01", "todo", "2026-06-01")).toBe("today");
    expect(dueState("2026-05-31", "done", "2026-06-01")).toBeUndefined();
    const g = groupArchived([{ path: "a" }, { path: "b", archivedAt: "2026-06-01" }, { path: "c", archivedAt: "2026-06-02" }, { path: "d", archivedAt: "2026-06-01" }]);
    expect(g.map(([k, v]) => [k, v.map((c) => c.path)])).toEqual([["2026-06-02", ["c"]], ["2026-06-01", ["b", "d"]], ["", ["a"]]]);
    expect(dueNear("2026-06-03", "todo", "2026-06-01", 2)).toBe(true);
    expect(dueNear("2026-06-04", "todo", "2026-06-01", 2)).toBe(false);
    expect(dueNear("2026-05-01", "done", "2026-06-01", 2)).toBe(false);
    expect(dueLabel("2026-06-01", "2026-01-01")).toBe("Jun 1");
    expect(dueLabel("2025-06-01", "2026-01-01")).toBe("Jun 1, 2025");
  });
});
