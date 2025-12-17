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

  it("初期表示でチャットログを末尾までスクロールする", async () => {
    const originalScrollTo = (HTMLElement.prototype as any).scrollTo;
    const scrollToMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      value: scrollToMock,
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

    await waitFor(() => expect(scrollToMock).toHaveBeenCalled());

    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      value: originalScrollTo ?? undefined,
      writable: true,
      configurable: true,
    });
    raf.mockRestore();
  });
});
