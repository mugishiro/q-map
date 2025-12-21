import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel";
import { Node } from "../types";

const baseNode = (overrides: Partial<Node> = {}): Node => {
  const now = new Date().toISOString();
  return {
    id: "node-1",
    label: "A1",
    topicId: "topic-1",
    parentId: null,
    title: "title",
    summary: "summary",
    type: "chat",
    createdAt: now,
    updatedAt: now,
    messages: [{ role: "user", content: "hi", createdAt: now }],
    ...overrides,
  };
};

describe("ChatPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Ctrl+Enter で送信する", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const onAddLater = vi.fn();
    const onDraftChange = vi.fn();
    const node = baseNode();

    render(
      <ChatPanel
        path={[node]}
        loading={false}
        onSend={onSend}
        onAddLater={onAddLater}
        draft="質問"
        onDraftChange={onDraftChange}
      />
    );

    const textarea = screen.getByPlaceholderText("わからないことをAIに質問する");
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ message: "質問" }));
    expect(onDraftChange).toHaveBeenCalledWith("");
  });

  it("初期表示で選択中ノードのメッセージへスクロールする", async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: scrollIntoViewMock,
      writable: true,
      configurable: true,
    });
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1 as any;
      });

    const now = new Date().toISOString();
    const node = baseNode({
      messages: [
        { role: "user", content: "Q1", createdAt: now },
        { role: "assistant", content: "A1", createdAt: now, pending: true as any },
      ],
    });

    render(
      <ChatPanel
        path={[node]}
        loading={false}
        onSend={vi.fn()}
        onAddLater={vi.fn()}
        draft=""
        onDraftChange={vi.fn()}
      />
    );

    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalled());

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: originalScrollIntoView ?? undefined,
      writable: true,
      configurable: true,
    });
    raf.mockRestore();
  });

  it("選択したテキストに対して操作ボタンを表示する", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const onAddLater = vi.fn().mockResolvedValue(undefined);
    const onDraftChange = vi.fn();
    const now = new Date().toISOString();
    const node = baseNode({
      messages: [{ role: "user", content: "選択テキスト", createdAt: now }],
    });

    const originalRangeRect = Range.prototype.getBoundingClientRect;
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      value: () =>
        ({
          top: 20,
          left: 30,
          right: 60,
          bottom: 40,
          width: 30,
          height: 20,
          x: 30,
          y: 20,
          toJSON: () => ({}),
        }) satisfies DOMRect,
      configurable: true,
    });

    render(
      <ChatPanel
        path={[node]}
        loading={false}
        onSend={onSend}
        onAddLater={onAddLater}
        draft=""
        onDraftChange={onDraftChange}
      />
    );

    try {
      const message = screen.getByText("選択テキスト");
      const selection = window.getSelection();
      expect(selection).not.toBeNull();
      if (!selection) return;

      const range = document.createRange();
      range.selectNodeContents(message);
      selection.removeAllRanges();
      selection.addRange(range);
      fireEvent.mouseUp(document);

      expect(await screen.findByRole("group", { name: "選択テキスト操作" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "聞く" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "あとで聞く" })).toBeInTheDocument();

      selection.removeAllRanges();
    } finally {
      if (originalRangeRect) {
        Object.defineProperty(Range.prototype, "getBoundingClientRect", {
          value: originalRangeRect,
          configurable: true,
        });
      } else {
        delete (Range.prototype as any).getBoundingClientRect;
      }
    }
  });
});
