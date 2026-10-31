import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { cleanDir, relativeTo, validateDir } from "@/lib/workspace";
import { setThemeMode, useThemeMode, type ThemeMode } from "@/theme";
import { useWorkspace } from "@/store/workspace";

const MODES: ThemeMode[] = ["system", "light", "dark"];

function FolderField({
  label,
  value,
  onChange,
  onError,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onError: (e: string | null) => void;
}) {
  const root = useWorkspace((s) => s.root)!;
  const browse = async () => {
    const dir = await open({ directory: true, defaultPath: root });
    if (typeof dir !== "string") return;
    const rel = relativeTo(root, dir);
    if (rel) onChange(rel);
    else onError("Folder must be inside the workspace");
  };
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1"
          value={value}
          onChange={(e) => (onError(null), onChange(e.target.value))}
        />
        <Button type="button" variant="outline" onClick={browse}>
          Browse…
        </Button>
      </div>
    </label>
  );
}

export function SettingsView() {
  const { root, config, saveConfig } = useWorkspace();
  const mode = useThemeMode();
  const [docs, setDocs] = useState(config.docsDir);
  const [tickets, setTickets] = useState(config.ticketsDir);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    const e = validateDir(docs, tickets) ?? validateDir(tickets, docs);
    setErr(e);
    if (e) return;
    await saveConfig({ docsDir: cleanDir(docs), ticketsDir: cleanDir(tickets) }).catch((x) => setErr(String(x)));
  };

  return (
    <div className="flex max-w-xl flex-col gap-8 overflow-auto p-6">
      {root && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Workspace</h2>
          <FolderField label="Docs folder" value={docs} onChange={setDocs} onError={setErr} />
          <FolderField label="Tickets folder" value={tickets} onChange={setTickets} onError={setErr} />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div>
            <Button onClick={save}>Save</Button>
          </div>
          <div className="text-xs text-muted-foreground">
            <div className="break-all select-text">{root}</div>
            <Button
              variant="link"
              className="h-auto p-0 text-xs"
              onClick={() => invoke("reveal_workspace", { path: root }).catch(console.warn)}
            >
              Reveal in Explorer
            </Button>
          </div>
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">App</h2>
        <div className="flex gap-2">
          {MODES.map((m) => (
            <Button key={m} variant={mode === m ? "default" : "outline"} className="capitalize" onClick={() => setThemeMode(m)}>
              {m}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
