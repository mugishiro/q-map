import { ComponentPropsWithoutRef, RefObject, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage, Node } from "../types";
import LaterList from "./LaterList";

const normalizeMarkdown = (text: string) => {
  const lines = text.split(/\r?\n/);
  const normalized: string[] = [];
  let pendingOrdered: string | null = null;
  let inList = false;
  let lastWasBlank = false;

  const pushBlank = () => {
    if (!lastWasBlank) {
      normalized.push("");
      lastWasBlank = true;
    }
  };

  lines.forEach((line) => {
    const withoutTrailing = line.trimEnd();
    const leadingMatch = withoutTrailing.match(/^(\s*)(.*)$/);
    const leading = leadingMatch?.[1] ?? "";
    const body = leadingMatch?.[2] ?? "";
    const trimmedBody = body.trim();
    const isEmpty = trimmedBody === "";

    if (isEmpty) {
      if (!inList && pendingOrdered === null) {
        pushBlank();
      }
      return;
    }

    const orderedOnly = trimmedBody.match(/^(\d+[\.．])$/);
    if (orderedOnly) {
      pendingOrdered = orderedOnly[1];
      inList = true;
      lastWasBlank = false;
      return;
    }

    const ordered = trimmedBody.match(/^(\d+[\.．])\s+(.+)/);
    if (ordered) {
      normalized.push(`${ordered[1]} ${ordered[2].trim()}`);
      pendingOrdered = null;
      inList = true;
      lastWasBlank = false;
      return;
    }

    const bullet = trimmedBody.match(/^([・･•●◦])\s*(.*)/);
    if (bullet) {
      const content = bullet[2].trim();
      if (!content) {
        inList = true;
        lastWasBlank = false;
        pendingOrdered = null;
        return;
      }
      if (pendingOrdered) {
        normalized.push(`${pendingOrdered}`);
      }
      const indent = pendingOrdered && leading.length === 0 ? "    " : leading;
      normalized.push(`${indent}- ${content}`);
      pendingOrdered = null;
      inList = true;
      lastWasBlank = false;
      return;
    }

    if (pendingOrdered) {
      normalized.push(`${pendingOrdered} ${trimmedBody}`);
      pendingOrdered = null;
      inList = true;
      lastWasBlank = false;
      return;
    }

    if (!lastWasBlank && normalized.length > 0) {
      pushBlank();
    }
    normalized.push(trimmedBody);
    inList = false;
    lastWasBlank = false;
  });

  return normalized.join("\n");
};

type HeadingProps = ComponentPropsWithoutRef<"h1"> & { node?: unknown };

const heading = (Tag: "h3" | "h4" | "h5") => {
  const Component = ({ node: _node, ...props }: HeadingProps) => <Tag {...props} />;
  return Component;
};

const markdownComponents = {
  h1: heading("h3"),
  h2: heading("h4"),
  h3: heading("h5"),
  h4: heading("h5"),
};

type Props = {
  path: Node[];
  loading: boolean;
  onSend: (input: { message: string; baseNodeId?: string }) => Promise<void>;
  onAddLater: (input: { summary: string }) => Promise<void>;
  draft: string;
  onDraftChange: (value: string) => void;
  onPrefillDraft?: (value: string) => void;
  inputRef?: RefObject<HTMLTextAreaElement>;
  isMobile?: boolean;
  disableAddLater?: boolean;
  laterItems?: { id: string; text: string; createdAt: string; parentId?: string | null }[];
  laterActiveId?: string | null;
  onOpenLater?: (item: { id: string; text: string; parentId: string | null }) => void;
  onDeleteLater?: (item: { id: string }) => void;
};

type ChatMessageView = ChatMessage & {
  pending?: boolean;
  nodeId: string;
  isQuestion: boolean;
};

export const ChatPanel = ({
  path,
  loading,
  onSend,
  onAddLater,
  draft,
  onDraftChange,
  onPrefillDraft,
  inputRef,
  isMobile = false,
  disableAddLater = false,
  laterItems = [],
  laterActiveId = null,
  onOpenLater,
  onDeleteLater,
}: Props) => {
  const canAddLater = !loading && Boolean(draft.trim()) && !disableAddLater;
  const logRef = useRef<HTMLDivElement | null>(null);
  const localInputRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = inputRef ?? localInputRef;
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);
  const [streaming, setStreaming] = useState<{ key: string; shown: string; full: string } | null>(null);
  const streamedKeys = useRef<Set<string>>(new Set());
  const streamFrameRef = useRef<number | null>(null);
  const prevLastAssistantKeyRef = useRef<string | null>(null);

  const history: ChatMessageView[] = useMemo(() => {
    const list: ChatMessageView[] = [];
    path.forEach((n) =>
      (n.messages || []).forEach((m) =>
        list.push({
          ...m,
          nodeId: n.id,
          pending:
            (m as any).pending === true ||
            (n.id.startsWith("temp-") && m.role === "assistant" && m.content === "考え中…"),
          isQuestion: m.role === "user",
        })
      )
    );
    return list;
  }, [path]);
  const selected = path[path.length - 1];

  useEffect(() => {
    const container = logRef.current;
    if (!container) return;
    if (!selected?.id) return;

    requestAnimationFrame(() => {
      const items = Array.from(container.querySelectorAll<HTMLElement>("[data-node-id]"));
      const target =
        items.find((el) => el.dataset.nodeId === selected.id && el.dataset.role === "user") ||
        items.find((el) => el.dataset.nodeId === selected.id);
      if (!target) return;
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
      } else {
        container.scrollTop = target.offsetTop;
      }
    });
  }, [selected?.id, history.length]);

  useEffect(() => {
    const container = logRef.current;
    if (!container) return;

    const isInside = (node: globalThis.Node | null) => (node ? container.contains(node) : false);

    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setSelection(null);
        return;
      }
      const anchor = sel.anchorNode;
      const focus = sel.focusNode;
      if (!isInside(anchor as any) || !isInside(focus as any)) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const top = rect.top - containerRect.top + container.scrollTop - 30;
      const left = rect.left - containerRect.left + container.scrollLeft;
      setSelection({ text, top: Math.max(0, top), left: Math.max(0, left) });
    };

    const clear = () => setSelection(null);

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);
    container.addEventListener("scroll", clear);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
      container.removeEventListener("scroll", clear);
    };
  }, []);

  const messageKey = (m: ChatMessageView) => `${m.nodeId}-${m.createdAt}-${m.content.length}`;

  useEffect(() => {
    // Stream the newest assistant message once per message key
    if (streamFrameRef.current) {
      window.cancelAnimationFrame(streamFrameRef.current);
      streamFrameRef.current = null;
    }
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant" && !m.pending);
    if (!lastAssistant || !lastAssistant.content) {
      setStreaming(null);
      return;
    }
    const key = messageKey(lastAssistant);
    const createdAtMs = Date.parse(lastAssistant.createdAt);
    const isRecent = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs < 30_000 : false;
    const isNewKey = key !== prevLastAssistantKeyRef.current;
    prevLastAssistantKeyRef.current = key;

    if (streamedKeys.current.has(key) || !isRecent || !isNewKey) {
      streamedKeys.current.add(key);
      setStreaming(null);
      return;
    }
    streamedKeys.current.add(key);
    if (streamedKeys.current.size > 200) {
      const first = streamedKeys.current.values().next().value;
      streamedKeys.current.delete(first);
    }

    const full = lastAssistant.content;
    const targetMs = Math.max(900, Math.min(3600, full.length * 26)); // adjust speed by length
    const started = performance.now();

    const tick = (now: number) => {
      const elapsed = now - started;
      const progress = Math.min(1, elapsed / targetMs);
      const nextCount = Math.max(1, Math.floor(full.length * progress));
      const next = full.slice(0, nextCount);
      setStreaming({ key, shown: next, full });
      if (progress < 1) {
        streamFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        streamFrameRef.current = null;
        setStreaming(null);
      }
    };
    setStreaming({ key, shown: "", full });
    streamFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (streamFrameRef.current) {
        window.cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }
    };
  }, [history]);

  useEffect(() => {
    if (!streaming || !logRef.current) return;
    const container = logRef.current;
    container.scrollTop = container.scrollHeight;
  }, [streaming?.shown]);

  const send = async () => {
    if (!draft.trim()) return;
    await onSend({ message: draft.trim() });
    onDraftChange("");
  };

  const addLater = async () => {
    if (disableAddLater) return;
    const summary = draft.trim();
    if (!summary) return;
    await onAddLater({ summary });
    onDraftChange("");
  };

  const prefillDraft = (text: string) => {
    if (!text.trim()) return;
    if (onPrefillDraft) {
      onPrefillDraft(text);
    } else {
      onDraftChange(text);
    }
  };

  return (
    <div className="stack gap-m chat-panel">
      <div className="chat-log bubble-style" ref={logRef}>
        {selection && (
          <div
            className="selection-toolbar"
            style={{ top: selection.top, left: selection.left }}
            role="group"
            aria-label="選択テキスト操作"
          >
            <button
              className="selection-btn"
              onClick={() => {
                prefillDraft(selection.text);
                window.getSelection()?.removeAllRanges();
                setSelection(null);
              }}
              type="button"
            >
              聞く
            </button>
            <button
              className="selection-btn"
              onClick={async () => {
                if (disableAddLater) return;
                await onAddLater({ summary: selection.text });
                window.getSelection()?.removeAllRanges();
                setSelection(null);
              }}
              disabled={disableAddLater}
              type="button"
            >
              あとで聞く
            </button>
          </div>
        )}
        {history.length === 0 && <div className="empty">会話がありません</div>}
        {history.map((m, idx) => (
          <div
            key={`${m.role}-${idx}`}
            className={`bubble-flat ${m.role} ${m.pending ? "pending" : ""} ${
              streaming && streaming.key === messageKey(m) ? "streaming" : ""
            }`}
            data-chat-item
            data-node-id={m.nodeId}
            data-role={m.role}
          >
            {m.pending ? (
              <div className="bubble-content">
                <span className="loader-dots" aria-label="考え中…">
                  <span className="loader-dot" />
                  <span className="loader-dot" />
                  <span className="loader-dot" />
                </span>
                <span style={{ marginLeft: "8px" }}>考え中…</span>
              </div>
            ) : (
              <div className="bubble-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {normalizeMarkdown(streaming && streaming.key === messageKey(m) ? streaming.shown : m.content)}
                </ReactMarkdown>
                {streaming &&
                  streaming.key === messageKey(m) &&
                  streaming.shown.length < streaming.full.length && (
                    <span className="stream-caret" aria-hidden="true" />
                  )}
              </div>
            )}
          </div>
        ))}
      </div>
      {laterItems.length > 0 && (
        <LaterList
          items={laterItems}
          activeId={laterActiveId}
          onOpen={(item) => onOpenLater?.({ ...item, parentId: item.parentId ?? null })}
          onRemove={onDeleteLater}
          variant="chips"
        />
      )}
      <div className="stack gap-s chat-input">
        <textarea
          className="input large"
          ref={textareaRef}
          rows={3}
          placeholder="わからないことをAIに質問する"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              void send();
            }
          }}
          disabled={loading}
        />
        <div className="chat-actions">
          <button
            className="btn ghost icon-only"
            onClick={addLater}
            disabled={!canAddLater}
            aria-label="あとで聞くに追加"
            title="あとで聞くに追加"
          >
            <span className="btn-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5V20l-4.5-3.5L8 20V4.5Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="none"
                  strokeLinejoin="round"
                />
                <path
                  d="M12.5 8.5v4M10.5 10.5h4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </button>
          <button className="btn solid icon-only" onClick={send} disabled={loading} aria-label="送信" title="送信">
            <span className="btn-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 12L20 4l-6 16-2.5-7L4 12Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
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
