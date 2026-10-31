import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView, keymap } from "@codemirror/view";
import { EditorSelection, Prec, type Extension } from "@codemirror/state";
import { parseMarkdown } from "@/lib/markdown";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { useIsDark } from "@/theme";

const base = [
  markdown({ codeLanguages: languages }),
  EditorView.lineWrapping,
  // let the app background show through instead of the CodeMirror theme's own
  Prec.highest(EditorView.theme({ "&": { backgroundColor: "transparent" }, ".cm-gutters": { backgroundColor: "transparent" } })),
];

/** `bodyOnly` hides the frontmatter block; saves keep the file's current one. */
export function MarkdownEditor({
  path,
  extensions = [],
  bodyOnly = false,
}: {
  path: string;
  extensions?: Extension[];
  bodyOnly?: boolean;
}) {
  const bodyOf = (c: string) => (bodyOnly ? parseMarkdown("", c).body : c);
  // CodeMirror holds "\n" only; CRLF files are converted back on save
  const lf = (s: string) => s.replace(/\r\n/g, "\n");
  const content = useWorkspace((s) => s.files[path]?.content);
  const stored = content === undefined ? undefined : lf(bodyOf(content));
  const writeFile = useWorkspace((s) => s.writeFile);
  const dark = useIsDark();
  const [value, setValue] = useState(stored ?? "");
  const [view, setView] = useState<EditorView>();
  const jump = useUi((s) => s.jump);
  const dirty = useRef(false); // unsaved local edits
  // Set in the path effect, not during render: the old file's cleanup flush must still see the old path.
  const latest = useRef({ path, value });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const { path: p, value: v } = latest.current;
    const cur = useWorkspace.getState().files[p]?.content ?? "";
    const full = cur.slice(0, cur.length - bodyOf(cur).length) + (cur.includes("\r\n") ? v.replace(/\n/g, "\r\n") : v);
    if (full !== cur) writeFile(p, full).catch(console.error);
  };

  // Switching files (or unmounting) flushes the pending save for the old file.
  useEffect(() => {
    const v = lf(bodyOf(useWorkspace.getState().files[path]?.content ?? ""));
    latest.current = { path, value: v };
    setValue(v);
    return flush;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // shortcut: external change with unsaved edits keeps the user's text, no conflict UI yet.
  useEffect(() => {
    if (!dirty.current && stored !== undefined) setValue(stored);
  }, [stored]);

  // Apply a search jump once the editor holds this file; offsets are into the full content, so skip bodyOnly.
  useEffect(() => {
    if (bodyOnly || !view || jump?.path !== path || view.state.doc.toString() !== stored) return;
    const len = view.state.doc.length;
    // offsets count the file's "\r"s, which the editor doesn't have
    const at = (n: number) => Math.min(n - (content!.slice(0, n).match(/\r\n/g)?.length ?? 0), len);
    const from = at(jump.from);
    view.dispatch({
      selection: EditorSelection.range(from, at(jump.to)),
      effects: EditorView.scrollIntoView(from, { y: "center" }),
    });
    view.focus();
    useUi.setState({ jump: null });
  }, [jump, path, value, view, stored, content, bodyOnly]);

  return (
    <CodeMirror
      value={value}
      onCreateEditor={setView}
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

/** Small standalone markdown editor (not tied to a file); Ctrl/Cmd+Enter calls `onSubmit`. */
export function MarkdownInput({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}) {
  const dark = useIsDark();
  const submit = useRef(onSubmit);
  submit.current = onSubmit;
  const extensions = useMemo(
    () => [...base, Prec.highest(keymap.of([{ key: "Mod-Enter", run: () => (submit.current(), true) }]))],
    [],
  );
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={dark ? "dark" : "light"}
      extensions={extensions}
      placeholder={placeholder}
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
      minHeight="2.25rem"
      maxHeight="8rem"
      className="min-w-0 flex-1 overflow-auto rounded-md border bg-background text-sm"
    />
  );
}
