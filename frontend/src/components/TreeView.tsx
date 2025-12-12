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

const sortByCreatedAt = (a: Node, b: Node) => (a.createdAt < b.createdAt ? -1 : 1);

type RenderRow = {
  node: TreeNode;
  depth: number;
  connectors: boolean[]; // which ancestor columns should continue downward
};

const buildRows = (tree: TreeNode[], depth = 0, connectors: boolean[] = []): RenderRow[] => {
  return tree
    .slice()
    .sort(sortByCreatedAt)
    .flatMap((node, idx, arr) => {
      const isLast = idx === arr.length - 1;
      const rowConnectors = [...connectors];
      if (depth > 0) {
        rowConnectors[depth - 1] = !isLast;
      }
      const row: RenderRow = { node, depth, connectors: rowConnectors };
      const childrenRows = buildRows(node.children, depth + 1, rowConnectors);
      return [row, ...childrenRows];
    });
};

export const TreeView = ({ nodes, selectedNodeId, onSelect }: Props) => {
  const tree = buildTree(nodes);
  const rows = buildRows(tree);
  const maxDepth = rows.reduce((acc, r) => Math.max(acc, r.depth), 0);
  const columns = Math.max(1, maxDepth + 1);
  return (
    <div className="stack gap-m">
      <div className="tree">
        {rows.length ? (
          <div className="git-graph">
            {rows.map((row) => {
              const selected = selectedNodeId === row.node.id;
              return (
                <div key={row.node.id} className={`git-row ${selected ? "active" : ""}`}>
                  <div className="git-rails" style={{ gridTemplateColumns: `repeat(${columns}, 24px)` }}>
                    {Array.from({ length: columns }).map((_, colIdx) => {
                      const isNodeColumn = colIdx === row.depth;
                      const hasAncestor = colIdx < row.depth;
                      const showTop = hasAncestor || (isNodeColumn && row.depth > 0);
                      const showBottom =
                        (hasAncestor && row.connectors[colIdx]) || (isNodeColumn && row.node.children.length > 0);
                      const showHorizontal = isNodeColumn && row.depth > 0;
                      return (
                        <div className="git-rail" key={`${row.node.id}-${colIdx}`}>
                          {showTop && <span className="git-line top" />}
                          {showBottom && <span className="git-line bottom" />}
                          {showHorizontal && <span className="git-line horizontal" />}
                          {isNodeColumn && (
                            <span
                              className={`git-dot ${selected ? "active" : ""} ${
                                row.node.type === "later" ? "ghost" : ""
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="tree-title-btn git"
                    onClick={() => onSelect(row.node.id)}
                    title={row.node.summary || row.node.title}
                  >
                    <span className="git-label">{row.node.label || ""}</span>
                    <span className="git-title-text">{row.node.title || row.node.summary || "(no title)"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">ノードなし</div>
        )}
      </div>
    </div>
  );
};

export default TreeView;
