import { Node } from "../types";

type Props = {
  path: Node[];
  onSelect: (nodeId: string) => void;
};

export const PathView = ({ path, onSelect }: Props) => {
  if (!path.length) {
    return (
      <div className="card stack gap-xs">
        <div className="label">パス</div>
        <div className="empty">ノードを選択してください</div>
      </div>
    );
  }
  return (
    <div className="card stack gap-s">
      <div className="label">パス</div>
      <div className="path">
        {path.map((n, idx) => (
          <button key={n.id} className="path-chip" onClick={() => onSelect(n.id)}>
            {n.label || idx + 1}. {n.title}
          </button>
        ))}
      </div>
    </div>
  );
};
