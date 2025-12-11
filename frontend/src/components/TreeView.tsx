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

type GraphLine = { id?: string; text: string; kind: "node" | "branch" };

export const TreeView = ({ nodes, selectedNodeId, onSelect }: Props) => {
  const tree = buildTree(nodes);

  const formatLabel = (node: TreeNode) => {
    const base = node.title || node.summary || "(no title)";
    return node.label ? `${node.label} ${base}` : base;
  };

  const lines: GraphLine[] = [];

  const renderGraph = (node: TreeNode, activeColumns: number[], columnIndex: number) => {
    const branchChars = activeColumns.map((_, idx) => (idx === columnIndex ? "o" : "|")).join(" ");
    lines.push({ id: node.id, text: `${branchChars}  ${formatLabel(node)}`, kind: "node" });

    const children = [...node.children].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    if (!children.length) return;

    if (children.length === 1) {
      renderGraph(children[0], activeColumns, columnIndex);
      return;
    }

    // 複数子ノードの場合は git graph の分岐ラインを描く
    const branchLineColumns = [...activeColumns];
    const extra = children.length - 1;
    for (let i = 0; i < extra; i += 1) {
      branchLineColumns.splice(columnIndex + 1 + i, 0, 1);
    }
    const start = columnIndex + 1;
    const end = columnIndex + extra;
    const branchLine = branchLineColumns
      .map((_, idx) => {
        if (idx === columnIndex) return "|";
        if (idx >= start && idx <= end) return "\\";
        return "|";
      })
      .join(" ");
    lines.push({ text: branchLine, kind: "branch" });

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
              <button
                key={line.id}
                className={`tree-graph-row ${selectedNodeId === line.id ? "active" : ""}`}
                onClick={() => line.id && onSelect(line.id)}
              >
                {line.text}
              </button>
            ) : (
              <div key={`branch-${idx}`} className="tree-graph-branch">
                {line.text}
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
