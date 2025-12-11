import type React from "react";
import { Node } from "../types";

type TreeNode = Node & { children: TreeNode[] };

const buildTree = (nodes: Node[]): TreeNode[] => {
  const map = new Map<string, TreeNode>();
  nodes.forEach((n) => map.set(n.id, { ...n, children: [] }));
  const roots: TreeNode[] = [];
  nodes.forEach((n) => {
    const item = map.get(n.id)!;
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(item);
    } else {
      roots.push(item);
    }
  });
  return roots;
};

type Props = {
  nodes: Node[];
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
};

type GraphRow = {
  id: string;
  title: string;
  depth: number;
  lines: boolean[];
  hasParent: boolean;
};

export const TreeView = ({ nodes, selectedNodeId, onSelect }: Props) => {
  const tree = buildTree(nodes);

  const formatLabel = (node: TreeNode) => {
    return node.title || node.summary || "(no title)";
  };

  const rows: GraphRow[] = [];

  const walk = (items: TreeNode[], depth: number, active: boolean[]) => {
    const sorted = [...items].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    sorted.forEach((node, idx) => {
      const isLast = idx === sorted.length - 1;
      rows.push({
        id: node.id,
        title: formatLabel(node),
        depth,
        lines: [...active],
        hasParent: depth > 0,
      });

      const nextActive = [...active];
      nextActive[depth] = !isLast;
      if (node.children.length) {
        walk(node.children, depth + 1, nextActive);
      }
    });
  };

  walk(
    tree.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    0,
    []
  );

  return (
    <div className="stack gap-m">
      <div className="label">ツリー</div>
      <div className="tree tree-graph">
        {rows.length ? (
          rows.map((row) => {
            const cols = row.depth + 1;
            return (
              <div
                key={row.id}
                className={`graph-row node ${selectedNodeId === row.id ? "active" : ""}`}
                style={{ ["--cols" as string]: cols } as React.CSSProperties}
              >
                <div className="graph-left">
                  {Array.from({ length: cols }).map((_, idx) => {
                    const showLine = idx < row.depth ? row.lines[idx] : false;
                    const isNode = idx === row.depth;
                    return (
                      <span
                        key={`${row.id}-col-${idx}`}
                        className={[
                          "graph-seg",
                          showLine ? "vertical" : "",
                          isNode ? "node-col" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        data-has-parent={row.hasParent && isNode ? "true" : "false"}
                      >
                        {isNode && <span className="graph-dot" />}
                      </span>
                    );
                  })}
                </div>
                <button className="graph-title" onClick={() => onSelect(row.id)}>
                  {row.title}
                </button>
              </div>
            );
          })
        ) : (
          <div className="empty">ノードなし</div>
        )}
      </div>
    </div>
  );
};
