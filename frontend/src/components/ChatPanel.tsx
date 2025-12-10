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
    await onSend({ message: message.trim() });
    setMessage("");
  };

  const addLater = async () => {
    if (!laterText.trim()) return;
    await onAddLater({ summary: laterText.trim() });
    setLaterText("");
  };

  return (
    <div className="stack gap-m">
      <div className="chat-log bubble-style">
        {history.length === 0 && <div className="empty">会話がありません</div>}
        {history.map((m, idx) => (
          <div key={`${m.role}-${idx}`} className={`bubble-flat ${m.role}`}>
            <div className="bubble-content">{m.content}</div>
          </div>
        ))}
      </div>
      <div className="stack gap-s chat-input">
        <textarea
          className="input large"
          rows={3}
          placeholder="わからないことをAIに質問する"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
        />
        <div className="chat-actions">
          <button className="btn ghost" onClick={addLater} disabled={!canAddLater}>
            {loading ? "追加中..." : "あとで聞くに追加"}
          </button>
          <button className="btn solid" onClick={send} disabled={loading}>
            {loading ? "送信中..." : "送信"}
          </button>
        </div>
        {!latest && <div className="helper-inline">追加するにはノードを選択してください。</div>}
      </div>
    </div>
  );
};

export default ChatPanel;
