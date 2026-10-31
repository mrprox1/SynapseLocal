import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Archive, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dueLabel, localDate, STATUS_TINT } from "@/lib/board";
import { cn } from "@/lib/utils";
import { CardFace, TicketCard, type Card } from "./TicketCard";

export function Column({
  status,
  label,
  cards,
  onOpen,
  onAdd,
  onArchive,
  onArchiveAll,
}: {
  status: string;
  label: string;
  cards: Card[];
  onOpen: (path: string) => void;
  onAdd: (title: string) => void;
  /** Done column only */
  onArchive?: (path: string) => void;
  onArchiveAll?: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: `col:${status}` });
  const [title, setTitle] = useState<string | null>(null);
  const add = () => {
    const t = title?.trim();
    setTitle(null);
    if (t) onAdd(t);
  };
  return (
    <section className={"flex min-h-0 w-64 shrink-0 flex-col rounded-xl bg-muted/50 p-2"}>
      <header className={cn("mb-2 flex items-center justify-between rounded-md px-2 py-1 text-sm font-medium", STATUS_TINT[status])}>
        <span>
          {label} <span className="text-muted-foreground">{cards.length}</span>
        </span>
        <span className="flex">
          {onArchiveAll && cards.some((c) => !c.archived) && (
            <Button variant="ghost" size="icon-xs" title="Archive all" aria-label="Archive all" onClick={onArchiveAll}>
              <Archive />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            title={`New ticket in ${label}`}
            aria-label={`New ticket in ${label}`}
            onClick={() => setTitle("")}
          >
            <Plus />
          </Button>
        </span>
      </header>
      {title !== null && (
        <input
          autoFocus
          value={title}
          placeholder="Ticket title"
          className="mb-2 rounded-md border bg-background px-2 py-1 text-sm"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
            if (e.key === "Escape") setTitle(null);
          }}
          onBlur={() => setTitle(null)}
        />
      )}
      <SortableContext items={cards.map((c) => c.path)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-16 flex-1 flex-col gap-2 overflow-auto">
          {cards.map((c) => (
            <TicketCard key={c.path} card={c} onOpen={onOpen} onArchive={c.archived ? undefined : onArchive} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

/** Read-only column of archived tickets, grouped by the day they were archived. */
export function ArchiveColumn({ groups, onOpen }: { groups: [string, Card[]][]; onOpen: (path: string) => void }) {
  const today = localDate(new Date());
  return (
    <section className="flex min-h-0 w-64 shrink-0 flex-col rounded-xl bg-muted/50 p-2">
      <header className="mb-2 flex items-center rounded-md bg-muted px-2 py-1 text-sm font-medium">
        Archived <span className="ml-1 text-muted-foreground">{groups.reduce((n, [, c]) => n + c.length, 0)}</span>
      </header>
      <div className="flex min-h-16 flex-1 flex-col gap-2 overflow-auto">
        {groups.map(([day, cards]) => (
          <div key={day} className="flex flex-col gap-2">
            <div className="px-1 text-xs font-medium text-muted-foreground">{day ? dueLabel(day, today) : "Unknown date"}</div>
            {cards.map((c) => (
              <button key={c.path} className="text-left" onClick={() => onOpen(c.path)}>
                <CardFace card={c} className="opacity-70" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
