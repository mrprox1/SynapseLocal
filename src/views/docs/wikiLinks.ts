import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import type { Extension, Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { isArchived, linkLabel } from "@/lib/board";
import { resolveLink } from "@/lib/markdown";
import { useWorkspace } from "@/store/workspace";

const LINK = /\[\[([^\][|]+)(?:\|[^\]]*)?\]\]/g;

/** Every file (doc, ticket, other) is a link target. */
const targets = () => Object.values(useWorkspace.getState().files);

function complete(ctx: CompletionContext) {
  const m = ctx.matchBefore(/\[\[[^\]\n]*/);
  if (!m) return null;
  const { files, config } = useWorkspace.getState();
  const names = new Map<string, boolean>(); // name → archived
  for (const f of Object.values(files)) {
    const a = isArchived(f.path, config.ticketsDir);
    for (const n of [f.title, f.path.split("/").pop()!.replace(/\.md$/i, "")]) names.set(n, a && names.get(n) !== false);
  }
  return {
    from: m.from + 2,
    options: [...names].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([label, archived]) => ({
      label,
      displayLabel: linkLabel(label, archived),
      // bracket auto-close may already have typed the `]]`
      apply: (view: EditorView, _: unknown, from: number, to: number) => {
        const insert = view.state.sliceDoc(to, to + 2) === "]]" ? label : label + "]]";
        view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + label.length + 2 } });
      },
    })),
    validFor: /^[^\]\n]*$/,
  };
}

function marks(view: EditorView): DecorationSet {
  const files = targets();
  const out: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (const m of text.matchAll(LINK)) {
      const resolved = resolveLink(m[1], files);
      out.push(
        Decoration.mark({ class: resolved ? "cm-wikilink" : "cm-wikilink cm-wikilink-missing" }).range(
          from + m.index,
          from + m.index + m[0].length,
        ),
      );
    }
  }
  return Decoration.set(out);
}

const marker = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    stale = false;
    unsub: () => void;
    constructor(view: EditorView) {
      this.decorations = marks(view);
      // a link target appearing or disappearing restyles links without an edit
      this.unsub = useWorkspace.subscribe((s, p) => {
        if (s.files === p.files) return;
        this.stale = true;
        view.dispatch({});
      });
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || this.stale) this.decorations = marks(u.view);
      this.stale = false;
    }
    destroy() {
      this.unsub();
    }
  },
  { decorations: (v) => v.decorations },
);

const theme = EditorView.baseTheme({
  ".cm-wikilink": { color: "#2563eb", cursor: "pointer" },
  "&dark .cm-wikilink": { color: "#60a5fa" },
  ".cm-wikilink-missing": { color: "#9ca3af", textDecoration: "underline dashed" },
});

/** Autocomplete on `[[`, link styling, and Ctrl/Cmd+click → `onOpen(target)`. */
export function wikiLinks(onOpen: (target: string) => void): Extension {
  return [
    autocompletion({ override: [complete] }),
    marker,
    theme,
    EditorView.domEventHandlers({
      mousedown(e, view) {
        if (!(e.ctrlKey || e.metaKey)) return false;
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos == null) return false;
        const line = view.state.doc.lineAt(pos);
        for (const m of line.text.matchAll(LINK)) {
          const start = line.from + m.index;
          if (pos >= start && pos <= start + m[0].length) {
            e.preventDefault();
            onOpen(m[1].trim());
            return true;
          }
        }
        return false;
      },
    }),
  ];
}
