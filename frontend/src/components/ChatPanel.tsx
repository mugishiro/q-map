import { useState } from "react";
import { ChatMessage, Node } from "../types";

type Props = {
  path: Node[];
  loading: boolean;
  onSend: (input: { message: string; baseNodeId?: string }) => Promise<void>;
  onAddLater: (input: { summary: string }) => Promise<void>;
};

export const ChatPanel = ({ path, loading, onSend, onAddLater }: Props) => {
  const [message, setMessage] = useState("");
  const [laterText, setLaterText] = useState("");
  const latest = path[path.length - 1];
  const canAddLater = Boolean(latest) && !loading;

  const history: ChatMessage[] = [];
  path.forEach((n) => (n.messages || []).forEach((m) => history.push(m)));

  const send = async () => {
    if (!message.trim()) return;
    await onSend({ message: message.trim(), baseNodeId: latest?.id });
    setMessage("");
  };

  const addLater = async () => {
    if (!laterText.trim()) return;
    await onAddLater({ summary: laterText.trim() });
    setLaterText("");
  };

  return (
    <div className="stack gap-m">
      <div className="label">チャット</div>
      <div className="chat-log">
        {history.length === 0 && <div className="empty">会話がありません</div>}
        {history.map((m, idx) => (
          <div key={`${m.role}-${idx}`} className={`bubble ${m.role}`}>
            <div className="bubble-role">{m.role}</div>
            <div className="bubble-content">{m.content}</div>
            <div className="bubble-meta">{new Date(m.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div className="stack gap-s">
        <textarea
          className="input"
          rows={3}
          placeholder="質問を入力..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
        />
        <button className="btn solid" onClick={send} disabled={loading}>
          {loading ? "送信中..." : "送信"}
        </button>
      </div>
      <div className="stack gap-xs card">
        <div className="label">あとで聞くノードを追加</div>
        <textarea
          className="input"
          rows={2}
          placeholder="あとで聞く内容"
          value={laterText}
          onChange={(e) => setLaterText(e.target.value)}
          disabled={loading || !latest}
        />
        <button className="btn ghost" onClick={addLater} disabled={!canAddLater}>
          {loading ? "追加中..." : "追加"}
        </button>
        {!latest && <div className="helper-inline">追加するにはノードを選択してください。</div>}
      </div>
    </div>
  );
};

export default ChatPanel;
