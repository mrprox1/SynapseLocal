import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Status } from "@/lib/board";
import { cn } from "@/lib/utils";

export type Card = {
  path: string;
  title: string;
  status: Status;
  order?: number;
  priority?: string;
  assignee?: string;
  done: number;
  total: number;
};

const PRIORITY_CLASS: Record<string, string> = {
  high: "bg-red-500/15 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  low: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

export function CardFace({ card, className }: { card: Card; className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-2 text-sm shadow-xs", className)}>
      <div className="font-medium">{card.title}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {card.priority && (
          <span className={cn("rounded px-1.5 py-0.5", PRIORITY_CLASS[card.priority])}>{card.priority}</span>
        )}
        {card.assignee && <span>{card.assignee}</span>}
        {card.total > 0 && (
          <span className="ml-auto">
            {card.done}/{card.total}
          </span>
        )}
      </div>
    </div>
  );
}

export function TicketCard({ card, onOpen }: { card: Card; onOpen: (path: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.path });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("cursor-grab touch-none", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card.path)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !isDragging) onOpen(card.path);
      }}
    >
      <CardFace card={card} />
    </div>
  );
}
