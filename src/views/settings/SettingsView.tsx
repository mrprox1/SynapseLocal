import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cleanDir, relativeTo, validateDir } from "@/lib/workspace";
import { setThemeMode, useThemeMode, type ThemeMode } from "@/theme";
import { useWorkspace } from "@/store/workspace";
import { TICKET_TEMPLATES } from "@/lib/tickets";

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
  const [soon, setSoon] = useState(String(config.dueSoonDays));
  const [err, setErr] = useState<string | null>(null);
  const [layout, setLayout] = useState<keyof typeof TICKET_TEMPLATES>("yaml");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(TICKET_TEMPLATES[layout]);
      setCopied(true);
      setCopyError(null);
    } catch {
      setCopyError("Could not copy template");
    }
  };

  const save = async () => {
    const e = validateDir(docs, tickets) ?? validateDir(tickets, docs);
    setErr(e);
    const n = Number(soon);
    if (!e && !(Number.isInteger(n) && n >= 0)) return setErr("Due soon must be a whole number of days");
    if (e) return;
    await saveConfig({ docsDir: cleanDir(docs), ticketsDir: cleanDir(tickets), dueSoonDays: n }).catch((x) => setErr(String(x)));
  };

  return (
    <div className="flex max-w-xl flex-col gap-8 overflow-auto p-6">
      {root && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Workspace</h2>
          <FolderField label="Docs folder" value={docs} onChange={setDocs} onError={setErr} />
          <FolderField label="Tickets folder" value={tickets} onChange={setTickets} onError={setErr} />
          <label className="flex flex-col gap-1 text-sm">
            Highlight tickets due within (days)
            <input
              type="number"
              min={0}
              className="w-24 rounded-md border bg-transparent px-2 py-1"
              value={soon}
              onChange={(e) => (setErr(null), setSoon(e.target.value))}
            />
          </label>
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
      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="font-medium">Ticket Header</h2>
        <div className="flex items-center justify-between gap-2">
          <div role="group" aria-label="Header layout" className="flex gap-2">
            {(["yaml", "table"] as const).map((value) => (
              <Button key={value} variant={layout === value ? "default" : "outline"} aria-pressed={layout === value} onClick={() => { setLayout(value); setCopied(false); setCopyError(null); }}>
                {value === "yaml" ? "YAML" : "Markdown Table"}
              </Button>
            ))}
          </div>
          <Button size="icon" variant="outline" title={copied ? "Copied" : "Copy header"} aria-label={copied ? "Copied" : "Copy header"} onClick={copyTemplate}>
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
        <textarea readOnly aria-label="Ticket header template" value={TICKET_TEMPLATES[layout]} rows={18} className="w-full resize-y rounded-md border bg-background p-3 font-mono text-xs" />
        <span role="status" className="sr-only">{copied ? "Header copied" : ""}</span>
        {copyError && <p role="alert" className="text-sm text-destructive">{copyError}</p>}
      </section>
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
