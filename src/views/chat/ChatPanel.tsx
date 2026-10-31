import { useEffect, useRef, useState } from "react";
import { Plus, Square } from "lucide-react";
import { MarkdownBody } from "@/components/MarkdownPreview";
import { Button } from "@/components/ui/button";
import { resolveLink } from "@/lib/markdown";
import { useChat } from "@/store/chat";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

const openLink = (t: string) => {
  const hit = resolveLink(t, Object.values(useWorkspace.getState().files));
  if (hit) useUi.getState().openPath(hit.path);
};

export function ChatPanel() {
  const { messages, running, error, send, stop, reset } = useChat();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages, error]);
  const submit = () => {
    if (!text.trim() || running) return;
    void send(text.trim());
    setText("");
  };
  return (
    <aside className="flex w-96 min-h-0 flex-col border-l">
      <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
        Claude
        <Button variant="ghost" size="sm" disabled={running} onClick={reset}>
          <Plus /> New chat
        </Button>
      </div>
      <div className="flex-1 space-y-2 overflow-auto p-3 text-sm">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-6 whitespace-pre-wrap rounded bg-accent p-2">{m.text}</div>
          ) : m.role === "assistant" ? (
            <div key={i} className="prose-preview"><MarkdownBody body={m.text} path="" onLink={openLink} /></div>
          ) : m.role === "tool" ? (
            <div key={i} className={`truncate text-xs ${m.isError ? "text-red-600" : "text-muted-foreground"}`}>
              {m.done ? (m.isError ? "✗" : "✓") : "…"} {m.line}
            </div>
          ) : (
            <div key={i} className="truncate text-xs italic text-muted-foreground">{m.text}</div>
          ),
        )}
        {error && <div className="whitespace-pre-wrap text-red-600">{error}</div>}
        <div ref={end} />
      </div>
      <div className="flex gap-2 border-t p-2">
        <textarea
          className="min-h-9 flex-1 resize-none rounded border bg-transparent p-2 text-sm"
          rows={2}
          placeholder="Ask Claude…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {running && (
          <Button variant="outline" size="icon" title="Stop" aria-label="Stop" onClick={stop}>
            <Square />
          </Button>
        )}
      </div>
    </aside>
  );
}
