import { useMemo, useState } from "react";

type Props = {
  items: { id: string; text: string; createdAt: string }[];
  onUse: (text: string) => void;
  onRemove: (id: string) => void;
};

export const LaterList = ({ items, onUse, onRemove }: Props) => {
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
            <div key={n.id} className="later-item" title={n.text}>
              <button className="later-main" onClick={() => onUse(n.text)} type="button">
                <span className="later-text">{n.text || "(no title)"}</span>
              </button>
              <button
                className="later-remove"
                onClick={() => onRemove(n.id)}
                type="button"
                aria-label="削除"
                title="削除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LaterList;
