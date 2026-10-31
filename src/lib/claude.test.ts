import { describe, expect, it } from "vitest";
import { parseEvent } from "./claude";

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
