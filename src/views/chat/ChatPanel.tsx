import { useEffect, useRef, useState } from "react";
import { Plus, Square } from "lucide-react";
import { MarkdownBody } from "@/components/MarkdownPreview";
import { Button } from "@/components/ui/button";
import { relPath } from "@/lib/claude";
import { resolveLink } from "@/lib/markdown";
import { useChat, type Msg } from "@/store/chat";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

const openLink = (t: string) => {
  const hit = resolveLink(t, Object.values(useWorkspace.getState().files));
  if (hit) useUi.getState().openPath(hit.path);
};

/** `Edit docs/foo.md`: the path is a link when it is a workspace file. */
function ToolLine({ m }: { m: Extract<Msg, { role: "tool" }> }) {
  const root = useWorkspace((s) => s.root);
  const files = useWorkspace((s) => s.files);
  const rel = root ? (relPath(root, m.arg) ?? m.arg) : m.arg;
  const label = m.name === "Grep" ? `"${m.arg}"` : rel;
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer truncate">
        {m.name}{" "}
        {files[rel] ? (
          <button className="text-blue-600 underline dark:text-blue-400" onClick={(e) => { e.preventDefault(); useUi.getState().openPath(rel); }}>
            {label}
          </button>
        ) : (
          label
        )}
      </summary>
      <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(m.input, null, 2)}</pre>
      {m.result !== undefined && (
        <pre className={`overflow-auto whitespace-pre-wrap ${m.isError ? "text-destructive" : ""}`}>{m.result}</pre>
      )}
    </details>
  );
}

/** `Changed 3 files:` with each path linking to its diff (if uncommitted) or the file. */
function Changes({ paths }: { paths: string[] }) {
  const files = useWorkspace((s) => s.files);
  const gitFiles = useWorkspace((s) => s.git?.files);
  return (
    <div className="text-xs">
      <div className="text-muted-foreground">Changed {paths.length} {paths.length === 1 ? "file" : "files"}:</div>
      {paths.map((p) =>
        gitFiles?.[p] || files[p] ? (
          <button
            key={p}
            className="block max-w-full truncate text-blue-600 underline dark:text-blue-400"
            onClick={() => (gitFiles?.[p] ? useUi.setState({ view: "git", selected: p }) : useUi.getState().openPath(p))}
          >
            {p}
          </button>
        ) : (
          <div key={p} className="truncate">{p}</div>
        ),
      )}
    </div>
  );
}

export function ChatPanel() {
  const { messages, running, error, send, stop, reset } = useChat();
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const pinned = useRef(true); // false once the user scrolls up
  useEffect(() => {
    const el = list.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages, error]);
  const current = useUi((s) => s.current);
  const [chip, setChip] = useState(true);
  useEffect(() => setChip(true), [current]);
  const submit = () => {
    if (!text.trim() || running) return;
    pinned.current = true;
    void send(text.trim(), chip && current ? `The user is looking at ${current}.

` : "");
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
      <div
        ref={list}
        className="flex-1 space-y-2 overflow-auto p-3 text-sm"
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-6 whitespace-pre-wrap rounded bg-accent p-2">{m.text}</div>
          ) : m.role === "assistant" ? (
            <div key={i} className="prose-preview"><MarkdownBody body={m.text} path="" onLink={openLink} /></div>
          ) : m.role === "tool" ? (
            <ToolLine key={i} m={m} />
          ) : m.role === "changes" ? (
            <Changes key={i} paths={m.paths} />
          ) : m.raw ? (
            <details key={i} className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Unknown event</summary>
              <pre className="overflow-auto whitespace-pre-wrap">{m.text}</pre>
            </details>
          ) : (
            <div key={i} className="truncate text-xs italic text-muted-foreground">{m.text}</div>
          ),
        )}
        {error && <div className="whitespace-pre-wrap text-red-600">{error}</div>}
      </div>
      {current && (
        <button
          className={`mx-2 mt-2 truncate rounded border px-2 py-0.5 text-left text-xs ${chip ? "bg-accent" : "text-muted-foreground line-through"}`}
          title="Tell Claude which file you are looking at"
          onClick={() => setChip(!chip)}
        >
          {current}
        </button>
      )}
      <div className="flex gap-2 p-2">
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
