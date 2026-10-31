import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { useWorkspace } from "@/store/workspace";

const base = [markdown({ codeLanguages: languages }), EditorView.lineWrapping];

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark")),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function MarkdownEditor({ path, extensions = [] }: { path: string; extensions?: Extension[] }) {
  const stored = useWorkspace((s) => s.files[path]?.content);
  const writeFile = useWorkspace((s) => s.writeFile);
  const dark = useIsDark();
  const [value, setValue] = useState(stored ?? "");
  const dirty = useRef(false); // unsaved local edits
  const latest = useRef({ path, value });
  latest.current = { path, value };
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const { path: p, value: v } = latest.current;
    if (v !== useWorkspace.getState().files[p]?.content) writeFile(p, v).catch(console.error);
  };

  // Switching files (or unmounting) flushes the pending save for the old file.
  useEffect(() => {
    setValue(useWorkspace.getState().files[path]?.content ?? "");
    return flush;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // shortcut: external change with unsaved edits keeps the user's text, no conflict UI yet.
  useEffect(() => {
    if (!dirty.current && stored !== undefined) setValue(stored);
  }, [stored]);

  return (
    <CodeMirror
      value={value}
      theme={dark ? "dark" : "light"}
      extensions={[...base, ...extensions]}
      onChange={(v) => {
        setValue(v);
        latest.current.value = v;
        dirty.current = true;
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, 500);
      }}
      onBlur={flush}
      height="100%"
      className="h-full overflow-auto text-sm"
    />
  );
}
