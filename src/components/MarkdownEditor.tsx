import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import { Prec, type Extension } from "@codemirror/state";
import { parseMarkdown } from "@/lib/markdown";
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
  const content = useWorkspace((s) => s.files[path]?.content);
  const stored = content === undefined ? undefined : bodyOf(content);
  const writeFile = useWorkspace((s) => s.writeFile);
  const dark = useIsDark();
  const [value, setValue] = useState(stored ?? "");
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
    const full = cur.slice(0, cur.length - bodyOf(cur).length) + v;
    if (full !== cur) writeFile(p, full).catch(console.error);
  };

  // Switching files (or unmounting) flushes the pending save for the old file.
  useEffect(() => {
    const v = bodyOf(useWorkspace.getState().files[path]?.content ?? "");
    latest.current = { path, value: v };
    setValue(v);
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
