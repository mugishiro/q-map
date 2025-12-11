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

export const TreeView = ({ nodes, selectedNodeId, onSelect }: Props) => {
  const tree = buildTree(nodes);

  const formatLabel = (node: TreeNode) => {
    const base = node.title || node.summary || "(no title)";
    return node.label ? `${node.label} ${base}` : base;
  };

  const lines: { id: string; text: string }[] = [];
  const walk = (items: TreeNode[], prefix: string) => {
    const sorted = [...items].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    sorted.forEach((node, idx) => {
      const isLast = idx === sorted.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const line = `${prefix}${connector}${formatLabel(node)}`;
      lines.push({ id: node.id, text: line });
      const nextPrefix = prefix + (isLast ? "    " : "│   ");
      if (node.children.length) {
        walk(node.children, nextPrefix);
      }
    });
  };
  walk(tree, "");

  return (
    <div className="stack gap-m">
      <div className="label">ツリー</div>
      <div className="tree tree-text">
        {lines.length ? (
          lines.map((line) => (
            <button
              key={line.id}
              className={`tree-text-row ${selectedNodeId === line.id ? "active" : ""}`}
              onClick={() => onSelect(line.id)}
            >
              {line.text}
            </button>
          ))
        ) : (
          <div className="empty">ノードなし</div>
        )}
      </div>
    </div>
  );
};
