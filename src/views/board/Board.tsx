import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { matchesFilter, placeCard, sortCards, STATUSES, subtasks, ticketOrder, ticketStatus, type Status } from "@/lib/board";
import { setFrontmatterKey } from "@/lib/frontmatter";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { FilterBar } from "./FilterBar";
import { Column } from "./Column";
import { TicketModal } from "./TicketModal";
import { CardFace, type Card } from "./TicketCard";

type Pending = Record<string, { status: Status; order: number }>;

// closestCorners alone measures corners, so a tall empty column loses to a card in the
// neighbouring column. Use what's under the pointer (card before column); keyboard falls back.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const cards = hits.filter((h) => !String(h.id).startsWith("col:"));
  return cards.length ? cards : hits.length ? hits : closestCorners(args);
};

export function Board() {
  const files = useWorkspace((s) => s.files);
  const current = useUi((s) => s.current);
  const filter = useUi((s) => s.boardFilter);
  const [pending, setPending] = useState<Pending>({}); // optimistic moves until the write lands
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Space picks up a card; Enter is left free to open it
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const cards = useMemo(
    () =>
      Object.values(files)
        .filter((f) => f.category === "ticket")
        .map<Card>((f) => {
          const a = f.frontmatter.assignee;
          const p = f.frontmatter.priority;
          const card: Card = {
            path: f.path,
            title: f.title,
            status: ticketStatus(f.frontmatter),
            order: ticketOrder(f.frontmatter),
            priority: typeof p === "string" ? p : undefined,
            assignee: a == null ? undefined : String(a),
            ...subtasks(f.body),
          };
          return { ...card, ...pending[f.path] };
        }),
    [files, pending],
  );
  const cols = useMemo(
    () =>
      Object.fromEntries(
        STATUSES.map((s) => [s.id, sortCards(cards.filter((c) => c.status === s.id && matchesFilter(c, filter)))]),
      ) as Record<Status, Card[]>,
    [cards, filter],
  );

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setActive(null);
    if (!over) return;
    const id = String(active.id);
    const overId = String(over.id);
    const card = cards.find((c) => c.path === id);
    if (!card) return;

    let to: Status;
    let index: number; // insertion index in the target column without the moved card
    if (overId.startsWith("col:")) {
      to = overId.slice(4) as Status;
      index = cols[to].filter((c) => c.path !== id).length;
    } else {
      const o = cards.find((c) => c.path === overId);
      if (!o) return;
      to = o.status;
      index = cols[to].findIndex((c) => c.path === overId);
    }
    if (to === card.status && index === cols[to].findIndex((c) => c.path === id)) return;

    // Place against the unfiltered column so hidden cards keep consistent `order` values.
    const visible = cols[to].filter((c) => c.path !== id);
    const full = sortCards(cards.filter((c) => c.status === to && c.path !== id));
    const next = visible[index];
    const prev = visible[index - 1];
    const fullIndex = next ? full.indexOf(next) : prev ? full.indexOf(prev) + 1 : full.length;
    const orders = placeCard(full, id, fullIndex);
    const moves = Object.entries(orders).map(([path, order]) => ({
      path,
      order,
      status: path === id ? to : cards.find((c) => c.path === path)!.status,
    }));
    setPending((p) => ({ ...p, ...Object.fromEntries(moves.map((m) => [m.path, { status: m.status, order: m.order }])) }));
    setError(null);
    try {
      const { writeFile } = useWorkspace.getState();
      for (const m of moves) {
        let c = useWorkspace.getState().files[m.path].content;
        if (m.path === id && to !== card.status) c = setFrontmatterKey(c, "status", to);
        await writeFile(m.path, setFrontmatterKey(c, "order", m.order));
      }
    } catch (e) {
      setError(`Could not save: ${e}`);
    } finally {
      setPending((p) => {
        const next = { ...p };
        for (const m of moves) delete next[m.path];
        return next;
      });
    }
  };

  const add = async (status: Status, title: string) => {
    try {
      useUi.getState().openPath(await useWorkspace.getState().createTicket(title, status));
    } catch (e) {
      setError(`Could not create ticket: ${e}`);
    }
  };

  const open = current && files[current]?.category === "ticket" ? current : null;
  const dragging = cards.find((c) => c.path === active);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error && (
        <div role="alert" className="border-b bg-destructive/10 px-3 py-1 text-sm text-destructive">
          {error}
        </div>
      )}
      <FilterBar cards={cards} />
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={(e) => setActive(String(e.active.id))}
        onDragCancel={() => setActive(null)}
        onDragEnd={(e) => void onDragEnd(e)}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
          {STATUSES.map((s) => (
            <Column
              key={s.id}
              status={s.id}
              label={s.label}
              cards={cols[s.id]}
              onOpen={(p) => useUi.getState().openPath(p)}
              onAdd={(t) => void add(s.id, t)}
            />
          ))}
        </div>
        <DragOverlay>{dragging && <CardFace card={dragging} className="shadow-lg" />}</DragOverlay>
      </DndContext>
      {open && <TicketModal key={open} path={open} onClose={() => useUi.setState({ current: null })} />}
    </div>
  );
}
