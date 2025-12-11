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
  hasChildren: boolean;
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
      const linesForRow = active.map((isLastAncestor, ancestorIdx) => {
        // 祖先の列は、祖先が最後の子でなければ継続する
        // 親列（depth-1）は親が最後でも、このノードへの接続のために継続させる
        if (ancestorIdx === depth - 1) return true;
        return !isLastAncestor;
      });

      rows.push({
        id: node.id,
        title: formatLabel(node),
        depth,
        lines: linesForRow.slice(0, depth),
        hasParent: depth > 0,
        hasChildren: node.children.length > 0,
      });

      const nextActive = [...active];
      nextActive[depth] = isLast;
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
      <div className="tree tree-graph">
        {rows.length ? (
          rows.map((row) => {
            const cols = row.depth + 1;
            return (
              <div
                key={row.id}
                className={`graph-row node ${selectedNodeId === row.id ? "active" : ""}`}
                style={
                  {
                    ["--cols" as string]: cols,
                    ["--depth" as string]: row.depth,
                  } as React.CSSProperties
                }
              >
                <div className="graph-left">
                  {Array.from({ length: row.depth }).map((_, idx) => {
                    const showLine = row.lines[idx];
                    return (
                      <span
                        key={`${row.id}-v-${idx}`}
                        className={`graph-conn vertical ${showLine ? "on" : ""}`}
                        style={{ left: `${idx * 20}px` }}
                      />
                    );
                  })}
                  <span
                    className="graph-node-col"
                    data-parent={row.hasParent}
                    data-children={row.hasChildren}
                    style={{ left: `${row.depth * 20}px` }}
                  >
                    <span className={`graph-dot ${selectedNodeId === row.id ? "active" : ""}`} />
                  </span>
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
