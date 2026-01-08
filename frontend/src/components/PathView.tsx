import { Node } from "../types";
import { useI18n } from "../i18n";

type Props = {
  path: Node[];
  onSelect: (nodeId: string) => void;
};

export const PathView = ({ path, onSelect }: Props) => {
  const { t } = useI18n();
  if (!path.length) {
    return (
      <div className="card stack gap-xs">
        <div className="label">{t("path.label")}</div>
        <div className="empty">{t("path.empty")}</div>
      </div>
    );
  }
  return (
    <div className="card stack gap-s">
      <div className="label">{t("path.label")}</div>
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
