import { useMemo, useState } from "react";
import { Topic } from "../types";

type Props = {
  topics: Topic[];
  selectedTopicId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
};

export const TopicList = ({ topics, selectedTopicId, onSelect, onCreate }: Props) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const sorted = useMemo(() => [...topics].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)), [topics]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate(name.trim());
      setName("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stack gap-m">
      <div className="stack gap-xs">
        <div className="label">トピック</div>
        <div className="stack gap-xs">
          <input
            className="input"
            placeholder="新規トピック名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            disabled={loading}
          />
          <button className="btn solid" onClick={handleCreate} disabled={loading}>
            {loading ? "追加中..." : "追加"}
          </button>
        </div>
      </div>
      <div className="list">
        {sorted.map((t) => (
          <button
            key={t.id}
            className={`list-item ${selectedTopicId === t.id ? "active" : ""}`}
            onClick={() => onSelect(t.id)}
          >
            <div className="list-title">{t.name}</div>
            <div className="list-meta">{new Date(t.updatedAt).toLocaleString()}</div>
          </button>
        ))}
        {!topics.length && <div className="empty">トピックがありません</div>}
      </div>
    </div>
  );
};
