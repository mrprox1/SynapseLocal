import { Channel, invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { changedPaths, parseEvent } from "@/lib/claude";
import { useWorkspace } from "@/store/workspace";

export type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | { role: "tool"; id: string; name: string; arg: string; input: unknown; result?: string; isError?: boolean }
  | { role: "changes"; paths: string[] }
  | { role: "note"; text: string; raw?: boolean }; // Stopped / cost line / unknown events (raw)

type Chat = {
  messages: Msg[];
  sessionId: string | null;
  running: boolean;
  error: string | null;
  send: (text: string, prefix?: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
};

const NOT_FOUND = "Claude Code CLI not found. Install it from https://claude.com/claude-code and restart the app.";

let stopped = false; // the current run was stopped by the user

export const useChat = create<Chat>((set, get) => ({
  messages: [],
  sessionId: null,
  running: false,
  error: null,
  send: async (text, prefix = "") => {
    const { root } = useWorkspace.getState();
    if (!root || get().running) return;
    stopped = false;
    const add = (m: Msg) => set((s) => ({ messages: [...s.messages, m] }));
    set((s) => ({ messages: [...s.messages, { role: "user", text }], running: true, error: null }));
    const ch = new Channel<string>();
    ch.onmessage = (line) => {
      for (const e of parseEvent(line)) {
        if (e.type === "init") set({ sessionId: e.sessionId });
        else if (e.type === "result") {
          if (e.sessionId) set({ sessionId: e.sessionId });
          const cost = e.cost === null ? "" : `$${e.cost.toFixed(4)}`;
          const turns = e.turns === null ? "" : `${e.turns} turns`;
          add({ role: "note", text: [cost, turns].filter(Boolean).join(" · ") });
        } else if (e.type === "text") {
          set((s) => {
            const last = s.messages[s.messages.length - 1];
            return last?.role === "assistant"
              ? { messages: [...s.messages.slice(0, -1), { role: "assistant", text: last.text + e.text }] }
              : { messages: [...s.messages, { role: "assistant", text: e.text }] };
          });
        } else if (e.type === "tool_use") {
          const inp = e.input as Record<string, unknown> | null;
          add({ role: "tool", id: e.id, name: e.name, arg: String(inp?.file_path ?? inp?.path ?? inp?.pattern ?? ""), input: e.input });
        } else if (e.type === "tool_result")
          set((s) => ({ messages: s.messages.map((m) => (m.role === "tool" && m.id === e.id ? { ...m, result: e.content, isError: e.isError } : m)) }));
        else if (e.type === "exit") {
          if (stopped) add({ role: "note", text: "Stopped" });
          else if (e.code !== 0) set({ error: e.stderr.trim() || `claude exited with code ${e.code}` });
          const paths = changedPaths(root, get().messages);
          if (paths.length) add({ role: "changes", paths });
          set({ running: false });
        } else if (e.type === "raw") add({ role: "note", text: e.line, raw: true });
      }
    };
    try {
      await invoke("claude_run", { root, message: prefix + text, sessionId: get().sessionId, onEvent: ch });
    } catch (e) {
      set({ running: false, error: e === "claude-not-found" ? NOT_FOUND : String(e) });
    }
  },
  stop: () => {
    stopped = true;
    void invoke("claude_stop");
  },
  reset: () => set({ messages: [], sessionId: null, error: null }),
}));
