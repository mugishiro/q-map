import { useState } from "react";
import { ChatMessage, Node } from "../types";

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const renderMarkdown = (text: string) => {
  let safe = escapeHtml(text);
  safe = safe.replace(/^###\s*(.+)$/gm, "<strong>$1</strong>");
  safe = safe.replace(/^##\s*(.+)$/gm, "<strong>$1</strong>");
  safe = safe.replace(/^\s*-\s+/gm, "• ");
  safe = safe.replace(/\n{2,}/g, "</p><p>");
  safe = safe.replace(/\n/g, "<br/>");
  return `<p>${safe}</p>`;
};

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
            <div
              className="bubble-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
            />
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
          <button
            className="btn ghost"
            onClick={addLater}
            disabled={!canAddLater}
            aria-label="あとで聞くに追加"
            title="あとで聞くに追加"
          >
            <span className="btn-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5v15.38a.5.5 0 0 1-.79.41L12 16l-5.21 4.29a.5.5 0 0 1-.79-.41V4.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
          <button className="btn solid" onClick={send} disabled={loading} aria-label="送信" title="送信">
            <span className="btn-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3.5 12.5 19.5 5 15 19 12.5 13.5 7 11z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
