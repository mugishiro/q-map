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

const TreeItem = ({
  node,
  isLast,
  selected,
  onSelect,
}: {
  node: TreeNode;
  isLast: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) => {
  const hasChildren = node.children.length > 0;
  return (
    <li className={`tree-item ${isLast ? "last" : ""}`}>
      <div className={`tree-row-new ${selected ? "active" : ""}`}>
        <span className="tree-connector" />
        <span className={`tree-dot ${selected ? "active" : ""}`} />
        <button className="tree-title-btn" onClick={() => onSelect(node.id)}>
          {node.title || node.summary || "(no title)"}
        </button>
      </div>
      {hasChildren && (
        <ul className="tree-graph-list">
          {node.children
            .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
            .map((child, idx, arr) => (
              <TreeItem
                key={child.id}
                node={child}
                isLast={idx === arr.length - 1}
                selected={child.id === selected}
                onSelect={onSelect}
              />
            ))}
        </ul>
      )}
    </li>
  );
};

export const TreeView = ({ nodes, selectedNodeId, onSelect }: Props) => {
  const tree = buildTree(nodes);
  return (
    <div className="stack gap-m">
      <div className="tree tree-graph">
        {tree.length ? (
          <ul className="tree-graph-list root">
            {tree
              .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
              .map((node, idx, arr) => (
                <TreeItem
                  key={node.id}
                  node={node}
                  isLast={idx === arr.length - 1}
                  selected={selectedNodeId === node.id}
                  onSelect={onSelect}
                />
              ))}
          </ul>
        ) : (
          <div className="empty">ノードなし</div>
        )}
      </div>
    </div>
  );
};

export default TreeView;
