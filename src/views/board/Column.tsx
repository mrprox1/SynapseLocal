import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Archive, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicketCard, type Card } from "./TicketCard";

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
    <section className="flex min-h-0 w-64 shrink-0 flex-col rounded-xl bg-muted/50 p-2">
      <header className="mb-2 flex items-center justify-between px-1 text-sm font-medium">
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
