import { describe, expect, it } from "vitest";
import { changedPaths, parseEvent, relPath } from "./claude";

const p = (o: unknown) => parseEvent(JSON.stringify(o));

describe("parseEvent", () => {
  it("reads init and result", () => {
    expect(p({ type: "system", subtype: "init", session_id: "s1" })).toEqual([{ type: "init", sessionId: "s1" }]);
    expect(p({ type: "result", session_id: "s1", total_cost_usd: 0.1, num_turns: 2, is_error: false })).toEqual([
      { type: "result", sessionId: "s1", cost: 0.1, turns: 2, isError: false },
    ]);
  });
  it("splits assistant blocks into text and tool_use", () => {
    const e = p({ type: "assistant", message: { content: [{ type: "text", text: "hi" }, { type: "tool_use", id: "t", name: "Edit", input: { file_path: "a.md" } }] } });
    expect(e).toEqual([{ type: "text", text: "hi" }, { type: "tool_use", id: "t", name: "Edit", input: { file_path: "a.md" } }]);
  });
  it("reads tool results", () => {
    expect(p({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t", content: [{ type: "text", text: "ok" }], is_error: true }] } })).toEqual([
      { type: "tool_result", id: "t", content: "ok", isError: true },
    ]);
  });
  it("reads our exit line", () => {
    expect(p({ type: "exit", code: null, stderr: "x" })).toEqual([{ type: "exit", code: null, stderr: "x" }]);
  });
  it("keeps garbage and unknown types as raw", () => {
    expect(parseEvent("nope")).toEqual([{ type: "raw", line: "nope" }]);
    expect(parseEvent('{"type":"weird"}')).toEqual([{ type: "raw", line: '{"type":"weird"}' }]);
  });
});

describe("relPath", () => {
  it("strips the root and normalizes backslashes", () => {
    expect(relPath("C:/w/proj", "C:\\w\\proj\\docs\\a.md")).toBe("docs/a.md");
    expect(relPath("/w/proj", "/w/proj/a.md")).toBe("a.md");
    expect(relPath("C:/w/proj", "c:\\w\\proj\\a.md")).toBe("a.md");
  });
  it("returns null outside the root", () => {
    expect(relPath("/w/proj", "/w/other/a.md")).toBeNull();
  });
});

describe("changedPaths", () => {
  const t = (name: string, arg: string, isError?: boolean) => ({ role: "tool", name, arg, result: "ok", isError });
  it("keeps successful edits of this run, deduped", () => {
    const msgs = [t("Edit", "C:/w/old.md"), { role: "user" }, t("Edit", "C:\\w\\a.md"), t("Write", "C:/w/b.md"), t("Edit", "C:/w/a.md"), t("Edit", "C:/w/bad.md", true), t("Read", "C:/w/r.md"), t("Edit", "D:/x.md"), { role: "tool", name: "Edit", arg: "C:/w/pending.md" }];
    expect(changedPaths("C:/w", msgs)).toEqual(["a.md", "b.md", "D:/x.md"]);
  });
});
