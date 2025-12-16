import { useMemo, useState } from "react";
import { Node } from "../types";

type GraphNode = Node & {
  lane: number;
  y: number;
  parents: string[];
  isPlaceholder?: boolean;
  hiddenCount?: number;
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
const BASE_LANE_GAP = 220;
const LANE_GAP_MIN = 140;
const DOT_RADIUS = 8;
const PADDING_X = 120;
const PADDING_Y = 32;
const MAX_VISIBLE_SIBLINGS = 3;

const byCreatedAt = (a: Node, b: Node) => (a.createdAt < b.createdAt ? -1 : 1);

const parentKey = (id: string | null | undefined) => id ?? "__root__";

const buildGraph = (nodes: (Node & { isPlaceholder?: boolean; hiddenCount?: number })[], mainRef?: string) => {
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
  const density = Math.min(1, graphNodes.length / Math.max(1, laneCount * 8));
  const laneGap = Math.max(LANE_GAP_MIN, BASE_LANE_GAP * (1 - density * 0.4));
  const height = PADDING_Y * 2 + maxDepth * ROW_HEIGHT;
  const width = PADDING_X * 2 + laneCount * laneGap;

  return { graphNodes, edges, laneCount, height, width, laneGap };
};

const laneX = (lane: number, gap: number) => PADDING_X + lane * gap;

const edgePath = (from: { lane: number; y: number }, to: { lane: number; y: number }) => {
  const x1 = laneX(from.lane);
  const x2 = laneX(to.lane);
  const y1 = from.y;
  const y2 = to.y;
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`;
};

export const TreeView = ({ nodes, selectedNodeId, onSelect, mainRef }: Props) => {
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const visibleNodes = useMemo(() => {
    const sorted = nodes.slice().sort(byCreatedAt) as (Node & { isPlaceholder?: boolean; hiddenCount?: number })[];
    const childrenMap = new Map<string, (Node & { isPlaceholder?: boolean; hiddenCount?: number })[]>();
    sorted.forEach((n) => {
      const key = parentKey(n.parentId);
      if (!childrenMap.has(key)) childrenMap.set(key, []);
      childrenMap.get(key)!.push(n);
    });

    const autoExpand = new Set(expandedParents);
    if (selectedNodeId) {
      childrenMap.forEach((list, key) => {
        const idx = list.findIndex((n) => n.id === selectedNodeId);
        if (idx >= MAX_VISIBLE_SIBLINGS) {
          autoExpand.add(key);
        }
      });
    }

    const seen = new Map<string, number>();
    const visible: (Node & { isPlaceholder?: boolean; hiddenCount?: number })[] = [];
    sorted.forEach((n) => {
      const key = parentKey(n.parentId);
      const total = childrenMap.get(key)?.length ?? 0;
      const expanded = autoExpand.has(key);
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      if (expanded || count <= MAX_VISIBLE_SIBLINGS) {
        visible.push(n);
      } else if (count === MAX_VISIBLE_SIBLINGS + 1 && total > MAX_VISIBLE_SIBLINGS) {
        const hiddenCount = total - MAX_VISIBLE_SIBLINGS;
        visible.push({
          ...n,
          id: `__collapsed-${key}`,
          label: "…",
          title: `+${hiddenCount} ノードを表示`,
          summary: "",
          isPlaceholder: true,
          hiddenCount,
        });
      }
    });
    return visible;
  }, [nodes, selectedNodeId, expandedParents]);

  const { graphNodes, edges, laneCount, height, width, laneGap } = useMemo(
    () => buildGraph(visibleNodes, mainRef),
    [visibleNodes, mainRef]
  );

  const pathSet = useMemo(() => {
    const map = new Map<string, Node>();
    visibleNodes.forEach((n) => map.set(n.id, n));
    const set = new Set<string>();
    let cur: string | null | undefined = selectedNodeId;
    while (cur) {
      if (set.has(cur)) break;
      set.add(cur);
      cur = map.get(cur)?.parentId ?? null;
    }
    return set;
  }, [visibleNodes, selectedNodeId]);

  const toggleParent = (parentId: string | null | undefined) => {
    const key = parentKey(parentId);
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
          const x = laneX(n.lane, laneGap);
          const isSelected = selectedNodeId === n.id;
          const onPath = pathSet.has(n.id);
          const isPlaceholder = Boolean((n as any).isPlaceholder);
          return (
            <button
              key={n.id}
              className={`gitk-node ${isSelected ? "active" : ""} ${n.type === "later" ? "ghost" : ""} ${
                onPath ? "path" : ""
              } ${isPlaceholder ? "placeholder" : ""}`}
              style={{ top: n.y, left: x }}
              data-node-id={n.id}
              data-lane={n.lane}
              data-testid="gitk-node"
              title={n.title || n.summary || ""}
              onClick={() => {
                if (isPlaceholder) {
                  toggleParent(n.parentId);
                } else {
                  onSelect(n.id);
                }
              }}
              type="button"
            >
              <span className="gitk-dot-btn">
                <span className="gitk-dot" />
              </span>
              <div className="gitk-labels">
                <div className="gitk-label">
                  <span className="gitk-label-title">
                    {isPlaceholder ? `+${(n as any).hiddenCount || ""}件` : n.title || n.summary || "(no title)"}
                  </span>
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
