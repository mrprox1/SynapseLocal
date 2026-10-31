import { Button } from "@/components/ui/button";
import { NO_FILTER, UNASSIGNED } from "@/lib/board";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import type { Card } from "./TicketCard";

export function FilterBar({ cards }: { cards: Card[] }) {
  const filter = useUi((s) => s.boardFilter);
  const setFilter = useUi((s) => s.setBoardFilter);
  const assignees = [...new Set(cards.flatMap((c) => (c.assignee ? [c.assignee] : [])))].sort();
  const toggle = (p: string) =>
    setFilter({
      ...filter,
      priorities: filter.priorities.includes(p) ? filter.priorities.filter((x) => x !== p) : [...filter.priorities, p],
    });
  const showArchived = useUi((s) => s.showArchived);
  const active = filter.priorities.length > 0 || filter.assignee !== "";
  return (
    <div className="flex items-center gap-2 border-b px-3 py-1 text-sm">
      {["low", "medium", "high", "none"].map((p) => (
        <Button
          key={p}
          size="xs"
          variant="outline"
          aria-pressed={filter.priorities.includes(p)}
          className={cn(filter.priorities.includes(p) && "bg-accent")}
          onClick={() => toggle(p)}
        >
          {p}
        </Button>
      ))}
      <select
        aria-label="Assignee"
        value={filter.assignee}
        className="rounded-md border bg-background px-2 py-0.5"
        onChange={(e) => setFilter({ ...filter, assignee: e.target.value })}
      >
        <option value="">Anyone</option>
        <option value={UNASSIGNED}>Unassigned</option>
        {assignees.map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
      <Button
        size="xs"
        variant="outline"
        aria-pressed={showArchived}
        className={cn("ml-auto", showArchived && "bg-accent")}
        onClick={() => useUi.setState({ showArchived: !showArchived })}
      >
        Show archived
      </Button>
      {active && (
        <Button size="xs" variant="ghost" onClick={() => setFilter(NO_FILTER)}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
