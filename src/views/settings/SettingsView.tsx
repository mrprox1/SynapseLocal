import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowDown, ArrowUp, Check, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cleanDir, relativeTo, validateDir } from "@/lib/workspace";
import { setThemeMode, useThemeMode, type ThemeMode } from "@/theme";
import { useWorkspace } from "@/store/workspace";
import { BUILTIN_KEYS, fieldKey, ticketTemplate, type TicketField } from "@/lib/tickets";

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

function FieldRow({ field, first, last, onChange, onMove, onDelete }: {
  field: TicketField;
  first: boolean;
  last: boolean;
  onChange: (f: TicketField) => void;
  onMove: (d: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(field.label);
  useEffect(() => setLabel(field.label), [field.label]);
  const commit = () => label.trim() && label.trim() !== field.label ? onChange({ ...field, label: label.trim() }) : setLabel(field.label);
  return (
    <div className="flex items-center gap-2">
      <input aria-label="Field label" className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-sm" value={label} onChange={(e) => setLabel(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
      <select aria-label="Field type" className="rounded-md border bg-background px-2 py-1 text-sm" value={field.type ?? "text"} onChange={(e) => onChange({ ...field, type: e.target.value === "links" ? "links" : "text" })}>
        <option value="text">text</option>
        <option value="links">links</option>
      </select>
      <Button size="icon" variant="ghost" title="Move up" aria-label="Move up" disabled={first} onClick={() => onMove(-1)}><ArrowUp /></Button>
      <Button size="icon" variant="ghost" title="Move down" aria-label="Move down" disabled={last} onClick={() => onMove(1)}><ArrowDown /></Button>
      <Button size="icon" variant="ghost" title="Remove field (files keep their data)" aria-label="Remove field" onClick={onDelete}><Trash2 /></Button>
    </div>
  );
}

export function SettingsView() {
  const { root, config, saveConfig } = useWorkspace();
  const mode = useThemeMode();
  const [docs, setDocs] = useState(config.docsDir);
  const [tickets, setTickets] = useState(config.ticketsDir);
  const [soon, setSoon] = useState(String(config.dueSoonDays));
  const [err, setErr] = useState<string | null>(null);
  const [layout, setLayout] = useState<"yaml" | "table">("yaml");
  const [newLabel, setNewLabel] = useState("");
  const [renamed, setRenamed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const template = ticketTemplate(layout, config.ticketFields);
  const setFields = (ticketFields: TicketField[]) => saveConfig({ ...config, ticketFields }).catch((x) => setErr(String(x)));
  const edit = (i: number, f: TicketField) => {
    if (f.label !== config.ticketFields[i].label) setRenamed(true);
    setFields(config.ticketFields.map((o, j) => (j === i ? f : o)));
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...config.ticketFields];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setFields(next);
  };
  const addField = () => {
    const label = newLabel.trim();
    const base = fieldKey(label);
    if (!base) return;
    const taken = new Set([...BUILTIN_KEYS, ...config.ticketFields.map((f) => f.key)]);
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;
    setNewLabel("");
    setFields([...config.ticketFields, { key, label }]);
  };
  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(template);
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
    await saveConfig({ docsDir: cleanDir(docs), ticketsDir: cleanDir(tickets), dueSoonDays: n, ticketFields: config.ticketFields }).catch((x) => setErr(String(x)));
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
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Built in: Title · Status · Priority · Assignee · Due</p>
          {config.ticketFields.map((f, i) => (
            <FieldRow key={f.key} field={f} first={i === 0} last={i === config.ticketFields.length - 1} onChange={(x) => edit(i, x)} onMove={(d) => move(i, d)} onDelete={() => setFields(config.ticketFields.filter((_, j) => j !== i))} />
          ))}
          <div className="flex gap-2">
            <input aria-label="New field label" placeholder="New field" className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-sm" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addField()} />
            <Button variant="outline" onClick={addField} disabled={!fieldKey(newLabel)}>Add field</Button>
          </div>
          {renamed && <p role="alert" className="text-xs text-amber-600 dark:text-amber-400">Renamed labels keep their key, so YAML tickets still work. Table tickets that use the old label stop matching until you rename their rows.</p>}
        </div>
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
        <textarea readOnly aria-label="Ticket header template" value={template} rows={18} className="w-full resize-y rounded-md border bg-background p-3 font-mono text-xs" />
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
