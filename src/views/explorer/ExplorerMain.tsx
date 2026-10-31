import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { openLink } from "@/views/docs/DocsView";

export function ExplorerMain() {
  const current = useUi((s) => s.current);
  const exists = useWorkspace((s) => current != null && s.files[current]?.category === "other");
  const [preview, setPreview] = useState(false);
  if (!current || !exists)
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Select a file</div>;
  return (
    <>
      <div className="flex justify-end border-b px-2 py-1">
        <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
          {preview ? "Edit" : "Preview"}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {preview ? (
          <MarkdownPreview path={current} onLink={(t) => openLink(t).catch(console.error)} />
        ) : (
          <MarkdownEditor path={current} />
        )}
      </div>
    </>
  );
}
