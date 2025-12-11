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

type GraphLine =
  | {
      kind: "node";
      id: string;
      title: string;
      columns: number;
      nodeColumn: number;
      activeColumns: number[];
    }
  | {
      kind: "branch";
      columns: number;
      activeColumns: number[];
      mainColumn: number;
      branchEnd: number;
    };

export const TreeView = ({ nodes, selectedNodeId, onSelect }: Props) => {
  const tree = buildTree(nodes);

  const formatLabel = (node: TreeNode) => {
    return node.title || node.summary || "(no title)";
  };

  const lines: GraphLine[] = [];

  const renderGraph = (node: TreeNode, activeColumns: number[], columnIndex: number) => {
    lines.push({
      kind: "node",
      id: node.id,
      title: formatLabel(node),
      columns: activeColumns.length,
      nodeColumn: columnIndex,
      activeColumns: [...activeColumns],
    });

    const children = [...node.children].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    if (!children.length) return;

    if (children.length === 1) {
      renderGraph(children[0], activeColumns, columnIndex);
      return;
    }

    const branchLineColumns = [...activeColumns];
    const extra = children.length - 1;
    for (let i = 0; i < extra; i += 1) {
      branchLineColumns.splice(columnIndex + 1 + i, 0, 1);
    }
    const start = columnIndex + 1;
    const end = columnIndex + extra;
    lines.push({
      kind: "branch",
      columns: branchLineColumns.length,
      activeColumns: branchLineColumns.map((_, idx) => idx),
      mainColumn: columnIndex,
      branchEnd: end,
    });

    children.forEach((child, idx) => {
      const childCol = columnIndex + idx;
      renderGraph(child, branchLineColumns.slice(), childCol);
    });
  };

  tree
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .forEach((root) => renderGraph(root, [1], 0));

  return (
    <div className="stack gap-m">
      <div className="label">ツリー</div>
      <div className="tree tree-graph">
        {lines.length ? (
          lines.map((line, idx) =>
            line.kind === "node" ? (
              <div
                key={line.id}
                className={`graph-row node ${selectedNodeId === line.id ? "active" : ""}`}
                style={{ ["--cols" as string]: line.columns } as React.CSSProperties}
              >
                <div className="graph-cols">
                  {Array.from({ length: line.columns }).map((_, colIdx) => {
                    const isNodeCol = colIdx === line.nodeColumn;
                    const isLine = line.activeColumns.includes(colIdx);
                    return (
                      <span
                        key={`${line.id}-col-${colIdx}`}
                        className={[
                          "graph-col",
                          isLine ? "line" : "gap",
                          isNodeCol ? "node-col" : "",
                          selectedNodeId === line.id ? "active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {isNodeCol && <span className="graph-dot" />}
                      </span>
                    );
                  })}
                </div>
                <button className="graph-title" onClick={() => onSelect(line.id)}>
                  {line.title}
                </button>
              </div>
            ) : (
              <div
                key={`branch-${idx}`}
                className="graph-row branch"
                style={{ ["--cols" as string]: line.columns } as React.CSSProperties}
              >
                <div className="graph-cols">
                  {Array.from({ length: line.columns }).map((_, colIdx) => {
                    const isLine = line.activeColumns.includes(colIdx);
                    const isCross = colIdx > line.mainColumn && colIdx <= line.branchEnd;
                    const isMain = colIdx === line.mainColumn;
                    return (
                      <span
                        key={`branch-${idx}-col-${colIdx}`}
                        className={[
                          "graph-col",
                          isLine ? "line" : "gap",
                          isCross ? "cross" : "",
                          isMain ? "branch-main" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      />
                    );
                  })}
                </div>
                <div className="graph-branch-label" />
              </div>
            )
          )
        ) : (
          <div className="empty">ノードなし</div>
        )}
      </div>
    </div>
  );
};
