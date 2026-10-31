import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { openLink } from "@/views/docs/DocsView";

export function ExplorerMain() {
  const current = useUi((s) => s.current);
  const exists = useWorkspace((s) => current != null && s.files[current]?.category === "other");
  const [preview, setPreview] = useState(false);
  const focus = useUi((s) => s.focus);
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && useUi.setState({ focus: false });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);
  if (!current || !exists)
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Select a file</div>;
  return (
    <>
      <div className="flex justify-end gap-1 border-b px-2 py-1">
        <Button variant="ghost" size="sm" title="Esc to exit" onClick={() => useUi.setState({ focus: !focus })}>
          {focus ? "Exit focus" : "Focus"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
          {preview ? "Edit" : "Preview"}
        </Button>
      </div>
      <div className={cn("mx-auto min-h-0 w-full flex-1", focus && "max-w-[70ch]")}>
        {preview ? (
          <MarkdownPreview path={current} onLink={(t) => openLink(t).catch(console.error)} />
        ) : (
          <MarkdownEditor path={current} />
        )}
      </div>
    </>
  );
}
