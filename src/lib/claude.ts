export type ChatEvent =
  | { type: "init"; sessionId: string }
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; content: string; isError: boolean }
  | { type: "result"; sessionId: string; cost: number | null; turns: number | null; isError: boolean }
  | { type: "exit"; code: number | null; stderr: string }
  | { type: "raw"; line: string };

const str = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v ?? ""));

/** One stream-json line → events (an assistant message can hold several blocks). Lenient: anything unknown is `raw`. */
export function parseEvent(line: string): ChatEvent[] {
  const raw: ChatEvent[] = [{ type: "raw", line }];
  let j: any;
  try {
    j = JSON.parse(line);
  } catch {
    return raw;
  }
  if (!j || typeof j !== "object") return raw;
  if (j.type === "system" && j.subtype === "init" && typeof j.session_id === "string")
    return [{ type: "init", sessionId: j.session_id }];
  if (j.type === "result")
    return [{ type: "result", sessionId: j.session_id ?? "", cost: j.total_cost_usd ?? null, turns: j.num_turns ?? null, isError: !!j.is_error }];
  if (j.type === "exit") return [{ type: "exit", code: j.code ?? null, stderr: str(j.stderr) }];
  if ((j.type === "assistant" || j.type === "user") && Array.isArray(j.message?.content)) {
    const out: ChatEvent[] = [];
    for (const b of j.message.content) {
      if (b?.type === "text" && j.type === "assistant") out.push({ type: "text", text: str(b.text) });
      else if (b?.type === "tool_use") out.push({ type: "tool_use", id: b.id, name: b.name, input: b.input });
      else if (b?.type === "tool_result")
        out.push({
          type: "tool_result",
          id: b.tool_use_id,
          content: Array.isArray(b.content) ? b.content.map((c: any) => str(c?.text ?? c)).join("") : str(b.content),
          isError: !!b.is_error,
        });
    }
    if (out.length) return out;
  }
  return raw;
}

/** Absolute (maybe backslashed) path → workspace-relative, or null when it is outside `root`. */
export function relPath(root: string, abs: string): string | null {
  const p = abs.split("\\").join("/");
  const r = root.split("\\").join("/").replace(/\/$/, "") + "/";
  return p.startsWith(r) ? p.slice(r.length) : null;
}
