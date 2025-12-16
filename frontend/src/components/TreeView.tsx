import { useMemo } from "react";
import { Node } from "../types";

type GraphNode = Node & {
  lane: number;
  y: number;
  parents: string[];
};

type GraphEdge = {
  parentId: string;
  childId: string;
  from: { lane: number; y: number };
  to: { lane: number; y: number };
  isMain: boolean;
};

type Props = {
  nodes: Node[];
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  mainRef?: string; // label or id that should stick to lane 0 if possible
};

const ROW_HEIGHT = 70;
const LANE_GAP = 72;
const DOT_RADIUS = 8;
const PADDING_X = 120;
const PADDING_Y = 32;

const byCreatedAt = (a: Node, b: Node) => (a.createdAt < b.createdAt ? -1 : 1);

const buildGraph = (nodes: Node[], mainRef?: string) => {
  const sorted = nodes.slice().sort(byCreatedAt);

  const nodeMap = new Map<string, Node>();
  sorted.forEach((n) => nodeMap.set(n.id, n));

  const childrenMap = new Map<string, string[]>();
  sorted.forEach((n) => {
    const parent = n.parentId;
    if (parent) {
      if (!childrenMap.has(parent)) childrenMap.set(parent, []);
      childrenMap.get(parent)!.push(n.id);
    }
  });
  // Sort children to give deterministic lane assignment
  childrenMap.forEach((list) =>
    list.sort((a, b) => {
      const na = sorted.find((n) => n.id === a);
      const nb = sorted.find((n) => n.id === b);
      if (!na || !nb) return 0;
      if (na.createdAt === nb.createdAt) return na.id < nb.id ? -1 : 1;
      return na.createdAt < nb.createdAt ? -1 : 1;
    })
  );

  const remainingChildren = new Map<string, number>();
  childrenMap.forEach((list, parent) => remainingChildren.set(parent, list.length));

  const processedChildCount = new Map<string, number>();
  const laneById = new Map<string, number>();
  let laneCounter = -1;

  const depthMemo = new Map<string, number>();
  const computeDepth = (id: string, visiting = new Set<string>()): number => {
    if (depthMemo.has(id)) return depthMemo.get(id)!;
    const node = nodeMap.get(id);
    if (!node || !node.parentId) {
      depthMemo.set(id, 0);
      return 0;
    }
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const depth = 1 + computeDepth(node.parentId, visiting);
    visiting.delete(id);
    depthMemo.set(id, depth);
    return depth;
  };

  const graphNodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let maxDepth = 0;

  sorted.forEach((node) => {
    const parents = ((node as any).parentIds as string[] | undefined) ?? (node.parentId ? [node.parentId] : []);
    const primaryParent = parents[0];

    let lane: number;
    const parentLane = primaryParent ? laneById.get(primaryParent) : undefined;
    const processedCount = primaryParent ? processedChildCount.get(primaryParent) ?? 0 : 0;
    const totalChildren = primaryParent ? childrenMap.get(primaryParent)?.length ?? 0 : 0;

    const isMainRef = mainRef ? node.label === mainRef || node.id === mainRef : false;

    if (isMainRef && laneById.has(node.id)) {
      lane = laneById.get(node.id)!;
    } else if (primaryParent && parentLane !== undefined) {
      lane = processedCount === 0 ? parentLane : ++laneCounter;
    } else if (isMainRef) {
      lane = 0;
    } else {
      lane = ++laneCounter;
    }

    laneById.set(node.id, lane);
    laneCounter = Math.max(laneCounter, lane);
    if (primaryParent) {
      processedChildCount.set(primaryParent, processedCount + 1);
    }

    const depth = computeDepth(node.id);
    const y = PADDING_Y + depth * ROW_HEIGHT;
    maxDepth = Math.max(maxDepth, depth);
    const gNode: GraphNode = { ...node, lane, y, parents };
    graphNodes.push(gNode);

    parents.forEach((pid) => {
      const pLane = laneById.get(pid);
      const pNode = graphNodes.find((n) => n.id === pid);
      if (pNode && pLane !== undefined) {
        edges.push({
          parentId: pid,
          childId: node.id,
          from: { lane: pLane, y: pNode.y },
          to: { lane, y },
          isMain: pLane === 0,
        });
      }
    });
  });

  const laneCount = Math.max(1, ...graphNodes.map((n) => n.lane + 1));
  const height = PADDING_Y * 2 + maxDepth * ROW_HEIGHT;
  const width = PADDING_X * 2 + laneCount * LANE_GAP;

  return { graphNodes, edges, laneCount, height, width };
};

const laneX = (lane: number) => PADDING_X + lane * LANE_GAP;

const edgePath = (from: { lane: number; y: number }, to: { lane: number; y: number }) => {
  const x1 = laneX(from.lane);
  const x2 = laneX(to.lane);
  const y1 = from.y;
  const y2 = to.y;
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`;
};

export const TreeView = ({ nodes, selectedNodeId, onSelect, mainRef }: Props) => {
  const { graphNodes, edges, laneCount, height, width } = useMemo(() => buildGraph(nodes, mainRef), [nodes, mainRef]);

  const pathSet = useMemo(() => {
    const map = new Map<string, Node>();
    nodes.forEach((n) => map.set(n.id, n));
    const set = new Set<string>();
    let cur: string | null | undefined = selectedNodeId;
    while (cur) {
      if (set.has(cur)) break;
      set.add(cur);
      cur = map.get(cur)?.parentId ?? null;
    }
    return set;
  }, [nodes, selectedNodeId]);

  if (!graphNodes.length) {
    return (
      <div className="stack gap-m">
        <div className="tree">
          <div className="empty">ノードなし</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack gap-m">
      <div className="tree gitk-shell" style={{ height, minWidth: width }}>
        <svg className="gitk-svg" width={width} height={height}>
          {edges.map((e, idx) => {
            const isPathEdge = pathSet.has(e.parentId) && pathSet.has(e.childId);
            return (
              <path
                key={`${e.from.lane}-${e.to.lane}-${idx}`}
                d={edgePath(e.from, e.to)}
                className={`gitk-edge ${e.isMain ? "main" : ""} ${isPathEdge ? "path" : ""}`}
              />
            );
          })}
        </svg>
        {graphNodes.map((n) => {
          const x = laneX(n.lane);
          const isSelected = selectedNodeId === n.id;
          const onPath = pathSet.has(n.id);
          return (
            <button
              key={n.id}
              className={`gitk-node ${isSelected ? "active" : ""} ${n.type === "later" ? "ghost" : ""} ${
                onPath ? "path" : ""
              }`}
              style={{ top: n.y, left: x }}
              data-node-id={n.id}
              data-lane={n.lane}
              data-testid="gitk-node"
              title={n.title || n.summary || ""}
              onClick={() => onSelect(n.id)}
              type="button"
            >
              <span className="gitk-dot-btn">
                <span className="gitk-dot" />
              </span>
              <div className="gitk-labels">
                <div className="gitk-label">
                  <span className="gitk-label-title">{n.title || n.summary || "(no title)"}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TreeView;
