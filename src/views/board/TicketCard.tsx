import { Archive, ChevronDown, ChevronUp, ChevronsUp } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { dueLabel, dueNear, dueState, localDate, type Status } from "@/lib/board";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";

export type Card = {
  path: string;
  title: string;
  status: Status;
  order?: number;
  priority?: string;
  assignee?: string;
  due?: string;
  archivedAt?: string;
  archived: boolean;
  done: number;
  total: number;
};

const PRIORITY_CLASS: Record<string, string> = {
  high: "bg-red-500/15 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  low: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

const PRIORITY_ICON: Record<string, typeof ChevronUp> = { high: ChevronsUp, medium: ChevronUp, low: ChevronDown };

export function CardFace({ card, className }: { card: Card; className?: string }) {
  const today = localDate(new Date());
  const due = dueState(card.due, card.status, today);
  const near = useWorkspace((s) => dueNear(card.due, card.status, today, s.config.dueSoonDays));
  const Icon = PRIORITY_ICON[card.priority ?? ""];
  return (
    <div className={cn("rounded-lg border bg-card p-2 text-sm shadow-xs", card.archived && "opacity-60", near && "border-red-500", className)}>
      <div className="font-medium">{card.title}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {card.priority && (
          <span className={cn("flex items-center gap-0.5 rounded px-1.5 py-0.5", PRIORITY_CLASS[card.priority])}>
            {Icon && <Icon className="size-3" />}
            {card.priority}
          </span>
        )}
        {card.due && (
          <span className={cn("rounded px-1.5 py-0.5", due && PRIORITY_CLASS[due === "overdue" ? "high" : "medium"])}>
            {dueLabel(card.due, today)}
          </span>
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

export function TicketCard({
  card,
  onOpen,
  onArchive,
}: {
  card: Card;
  onOpen: (path: string) => void;
  onArchive?: (path: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.path });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative cursor-grab touch-none", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card.path)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !isDragging) onOpen(card.path);
      }}
    >
      <CardFace card={card} />
      {onArchive && (
        <button
          title="Archive"
          aria-label="Archive"
          className="absolute top-1 right-1 hidden rounded p-1 text-muted-foreground hover:bg-accent group-hover:block focus-visible:block"
          // keep the card's drag and open handlers out of it
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onArchive(card.path);
          }}
        >
          <Archive className="size-3.5" />
        </button>
      )}
    </div>
  );
}
