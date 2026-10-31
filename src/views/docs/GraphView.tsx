import { useEffect, useMemo, useState } from "react";
import { applyNodeChanges, Background, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { forceCenter, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from "d3-force";
import { resolveLink } from "@/lib/markdown";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { useIsDark } from "@/theme";

type Sim = SimulationNodeDatum & { id: string; label: string };

export function GraphView() {
  const files = useWorkspace((s) => s.files);
  const { current, openPath } = useUi();
  const dark = useIsDark();

  const docs = useMemo(
    () => Object.values(files).filter((f) => f.category === "doc"),
    [files],
  );
  const edges = useMemo(() => {
    const set = new Set<string>();
    for (const f of docs)
      for (const t of f.links) {
        const hit = resolveLink(t, docs);
        if (hit && hit.path !== f.path) set.add(JSON.stringify([f.path, hit.path]));
      }
    return [...set].sort().map((s) => JSON.parse(s) as [string, string]);
  }, [docs]);

  // Re-layout only when nodes/edges change, not on content edits.
  const key = JSON.stringify([docs.map((d) => [d.path, d.title]).sort(), edges]);
  const layout = useMemo(() => {
    const nodes: Sim[] = docs.map((d) => ({ id: d.path, label: d.title }));
    const sim = forceSimulation(nodes)
      .force("link", forceLink<Sim, { source: string; target: string }>(edges.map(([source, target]) => ({ source, target }))).id((n) => n.id).distance(80))
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(0, 0))
      .stop();
    sim.tick(300);
    return nodes.map((n): Node => ({ id: n.id, position: { x: n.x ?? 0, y: n.y ?? 0 }, data: { label: n.label } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [nodes, setNodes] = useState<Node[]>(layout);
  useEffect(() => setNodes(layout), [layout]);

  const near = useMemo(() => {
    const s = new Set<string>(current ? [current] : []);
    for (const [a, b] of edges) {
      if (a === current) s.add(b);
      if (b === current) s.add(a);
    }
    return s;
  }, [edges, current]);

  const shown: Node[] = nodes.map((n) => ({
    ...n,
    style: {
      opacity: !current || near.has(n.id) ? 1 : 0.3,
      fontWeight: n.id === current ? 700 : 400,
      border: n.id === current ? "2px solid #3b82f6" : undefined,
    },
  }));
  const shownEdges: Edge[] = edges.map(([source, target]) => ({
    id: `${source}→${target}`,
    source,
    target,
    style: { opacity: !current || source === current || target === current ? 1 : 0.2 },
  }));

  return (
    <ReactFlow
      nodes={shown}
      edges={shownEdges}
      onNodesChange={(c) => setNodes((ns) => applyNodeChanges(c, ns))}
      onNodeClick={(_, n) => openPath(n.id)}
      nodesConnectable={false}
      colorMode={dark ? "dark" : "light"}
      fitView
    >
      <Background />
    </ReactFlow>
  );
}
