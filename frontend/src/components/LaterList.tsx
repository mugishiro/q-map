import { useMemo, useState } from "react";

type LaterItem = {
  id: string;
  text: string;
  createdAt: string;
  label?: string;
  parentLabel?: string;
};

type Props = {
  items: LaterItem[];
  activeId: string | null;
  onOpen: (item: LaterItem) => void;
};

export const LaterList = ({ items, activeId, onOpen }: Props) => {
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [items]
  );

  return (
    <div className="card later-card">
      <button className="later-header" onClick={() => setOpen((v) => !v)} type="button">
        <div className="later-title">
          <span>後で聞く</span>
          <span className="later-count">{items.length}</span>
        </div>
        <span aria-hidden="true" className={`later-chevron ${open ? "open" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="later-list">
          {sorted.length === 0 && <div className="empty">登録なし</div>}
          {sorted.map((n) => (
            <button
              key={n.id}
              className={`later-item ${n.id === activeId ? "active" : ""}`}
              title={n.text}
              onClick={() => onOpen(n)}
              type="button"
            >
              {(n.label || n.parentLabel) && (
                <div className="later-meta-line">
                  {n.label && <span className="later-label">{n.label}</span>}
                  {n.parentLabel && <span className="later-parent">親: {n.parentLabel}</span>}
                </div>
              )}
              <div className="later-text" aria-label="保存済みの質問">
                {n.text || "(no title)"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LaterList;
