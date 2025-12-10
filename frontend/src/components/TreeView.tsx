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

  const renderNode = (node: TreeNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const active = selectedNodeId === node.id;
    return (
      <div key={node.id} className="tree-node" style={{ marginLeft: depth * 12 }}>
        <button className={`tree-row ${active ? "active" : ""}`} onClick={() => onSelect(node.id)}>
          <div className={`tree-bullet ${node.type} ${active ? "active" : ""}`} />
          <div className="tree-body">
            <div className="tree-line">
              <span className="tree-title">{node.title}</span>
            </div>
          </div>
        </button>
        {hasChildren && (
          <div className="tree-children">
            {node.children
              .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
              .map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="stack gap-m">
      <div className="label">ツリー</div>
      <div className="tree">{tree.length ? tree.map((n) => renderNode(n)) : <div className="empty">ノードなし</div>}</div>
    </div>
  );
};
