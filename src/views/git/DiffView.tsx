import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import { Button } from "@/components/ui/button";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

export function DiffView() {
  const selected = useUi((s) => s.selected);
  const openPath = useUi((s) => s.openPath);
  const root = useWorkspace((s) => s.root);
  const git = useWorkspace((s) => s.git);
  const code = selected ? git?.files[selected] : undefined;
  const [diff, setDiff] = useState("");
  const [error, setError] = useState<string | null>(null);

  // `git` is replaced on every rescan, so this also refreshes when the file changes on disk
  useEffect(() => {
    if (selected && !code) return void useUi.setState({ selected: null }); // committed or reverted
    if (!selected || !root) return;
    let stale = false;
    invoke<string>("git_diff", { root, path: selected })
      .then((d) => !stale && (setDiff(d), setError(null)))
      .catch((e) => !stale && setError(String(e)));
    return () => void (stale = true);
  }, [selected, code, root, git]);

  if (!selected) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select a change to see its diff</div>;
  }
  const fence = "`".repeat(Math.max(3, ...(diff.match(/`+/g) ?? []).map((m) => m.length + 1)));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2 text-sm">
        <span className="truncate font-medium">{selected}</span>
        {code !== "D" && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => openPath(selected)}>
            Open
          </Button>
        )}
      </div>
      <div className="prose-preview flex-1 overflow-auto p-6">
        {error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : (
          <Markdown rehypePlugins={[rehypeHighlight]}>{`${fence}diff\n${diff}\n${fence}`}</Markdown>
        )}
      </div>
    </div>
  );
}
