import { useMemo, useState } from "react";

type LaterItem = {
  id: string;
  text: string;
  createdAt: string;
  label?: string;
  parentLabel?: string;
  parentId?: string | null;
};

type Props = {
  items: LaterItem[];
  activeId: string | null;
  onOpen: (item: LaterItem) => void;
  onRemove?: (item: LaterItem) => void;
  variant?: "panel" | "inline" | "chips";
};

export const LaterList = ({ items, activeId, onOpen, onRemove, variant = "panel" }: Props) => {
  const [tooltipId, setTooltipId] = useState<string | null>(null);
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [items]
  );

  const isTruncated = (el: HTMLElement | null) => {
    if (!el) return false;
    return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
  };

  const handleTooltipEnter = (id: string, text: string, el: HTMLElement | null) => {
    if (!text) {
      setTooltipId(null);
      return;
    }
    setTooltipId(isTruncated(el) ? id : null);
  };

  const handleTooltipLeave = () => setTooltipId(null);

  if (variant === "chips") {
    return (
      <div className="later-chips" aria-label="後で聞く">
        {sorted.map((n) => (
          <div
            key={n.id}
            className={`later-chip ${n.id === activeId ? "active" : ""} ${tooltipId === n.id ? "has-tooltip" : ""}`}
            data-tooltip={tooltipId === n.id ? n.text : undefined}
            onMouseEnter={(e) => {
              const textEl = e.currentTarget.querySelector<HTMLElement>(".later-chip-text");
              handleTooltipEnter(n.id, n.text, textEl);
            }}
            onMouseLeave={handleTooltipLeave}
          >
            <button className="later-chip-text" type="button" onClick={() => onOpen(n)} aria-label={n.text}>
              {n.text || "(no title)"}
            </button>
            {onRemove && (
              <button
                className="later-chip-remove"
                type="button"
                aria-label="削除"
                onClick={() => onRemove(n)}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {sorted.length === 0 && <div className="empty later-chip-empty">登録なし</div>}
      </div>
    );
  }

  const content = (
    <>
      <div className="later-header" aria-label="後で聞く">
        <div className="later-title">
          <span>後で聞く</span>
          <span className="later-count">{items.length} 件</span>
        </div>
      </div>
      <div className="later-list">
        {sorted.length === 0 && <div className="empty">登録なし</div>}
        {sorted.map((n) => (
          <button
            key={n.id}
            className={`later-item ${n.id === activeId ? "active" : ""} ${tooltipId === n.id ? "has-tooltip" : ""}`}
            data-tooltip={tooltipId === n.id ? n.text : undefined}
            aria-label={n.text || "保存済みの質問"}
            onClick={() => onOpen(n)}
            onMouseEnter={(e) => {
              const textEl = e.currentTarget.querySelector<HTMLElement>(".later-text");
              handleTooltipEnter(n.id, n.text, textEl);
            }}
            onMouseLeave={handleTooltipLeave}
            type="button"
          >
            <div className="later-text" aria-label="保存済みの質問">
              {n.text || "(no title)"}
            </div>
          </button>
        ))}
      </div>
    </>
  );

  if (variant === "inline") {
    return <div className="later-inline">{content}</div>;
  }

  return <div className="card later-card">{content}</div>;
};

export default LaterList;
