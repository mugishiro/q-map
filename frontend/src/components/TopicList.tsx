import { useMemo } from "react";
import { Topic } from "../types";

type Props = {
  topics: Topic[];
  selectedTopicId: string | null;
  onSelect: (id: string) => void;
};

export const TopicList = ({ topics, selectedTopicId, onSelect }: Props) => {
  const sorted = useMemo(() => [...topics].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)), [topics]);

  return (
    <div className="stack gap-s">
      <div className="list">
        {sorted.map((t) => (
          <button
            key={t.id}
            className={`list-item ${selectedTopicId === t.id ? "active" : ""}`}
            onClick={() => onSelect(t.id)}
          >
            <div className="list-title">{t.name}</div>
          </button>
        ))}
        {!topics.length && <div className="empty">チャットがありません</div>}
      </div>
    </div>
  );
};
