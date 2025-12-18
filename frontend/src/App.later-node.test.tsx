import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import App from "./App";
import { api } from "./api";

vi.mock("./theme", () => ({ initTheme: vi.fn() }));
vi.mock("./auth", () => ({
  auth: {
    startLogin: vi.fn(),
    exchangeCodeForToken: vi.fn(),
    clearAuthArtifacts: vi.fn(),
  },
}));
vi.mock("./api", () => {
  const apiMock = {
    listTopics: vi.fn(),
    listNodes: vi.fn(),
    postChat: vi.fn(),
    createLaterNode: vi.fn(),
    setToken: vi.fn(),
    getToken: vi.fn(),
    clearToken: vi.fn(),
  };
  return { api: apiMock };
});

const setupMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
};

describe("later node promotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMatchMedia();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      value: vi.fn(),
      writable: true,
    });
  });

  it("昇格時に既存の後で聞くノードを更新し、新規ノードを作らない", async () => {
    const now = new Date().toISOString();
    const topic = { id: "topic-1", topicId: "topic-1", name: "T", createdAt: now, updatedAt: now };
    const rootNode = {
      id: "node-root",
      nodeId: "node-root",
      label: "A1",
      topicId: topic.id,
      parentId: null,
      title: "root",
      summary: "root",
      type: "chat" as const,
      createdAt: now,
      updatedAt: now,
      messages: [{ role: "user" as const, content: "root", createdAt: now }],
    };
    const laterNode = {
      id: "node-later",
      nodeId: "node-later",
      label: "B1",
      topicId: topic.id,
      parentId: rootNode.id,
      title: "あとで：テスト",
      summary: "あとで：テスト",
      type: "later" as const,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    const promotedNode = {
      ...laterNode,
      title: "送信メッセージ",
      summary: "送信メッセージ",
      type: "chat" as const,
      updatedAt: new Date().toISOString(),
      messages: [
        { role: "user" as const, content: "送信メッセージ", createdAt: now },
        { role: "assistant" as const, content: "回答", createdAt: now },
      ],
    };

    api.getToken.mockReturnValue("token");
    api.listTopics.mockResolvedValue({ items: [topic] });
    const listNodesResponses = [{ items: [rootNode, laterNode] }, { items: [rootNode, promotedNode] }];
    api.listNodes.mockImplementation(async () => listNodesResponses.shift() ?? { items: [] });
    api.postChat.mockResolvedValue({ node: promotedNode });

    render(<App />);

    await waitFor(() => expect(api.listNodes).toHaveBeenCalled());

    const laterButton = (await screen.findAllByTestId("gitk-node")).find(
      (el) => el.getAttribute("data-node-id") === "node-later"
    );
    expect(laterButton).toBeTruthy();
    await userEvent.click(laterButton!);

    const textarea = screen.getByPlaceholderText("わからないことをAIに質問する");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "送信メッセージ");

    const sendButton = screen.getByRole("button", { name: "送信" });
    await userEvent.click(sendButton);

    await waitFor(() =>
      expect(api.postChat).toHaveBeenCalledWith(
        expect.objectContaining({ nodeId: "node-later", topicId: topic.id, message: "送信メッセージ" })
      )
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("gitk-node").length).toBe(2);
      expect(document.querySelectorAll(".gitk-node.later").length).toBe(0);
    });
  });

  it("下書きを自動入力し、昇格時に同じノードを更新する", async () => {
    const now = new Date().toISOString();
    const topic = { id: "topic-1", topicId: "topic-1", name: "T", createdAt: now, updatedAt: now };
    const rootNode = {
      id: "node-root",
      nodeId: "node-root",
      label: "A1",
      topicId: topic.id,
      parentId: null,
      title: "root",
      summary: "root",
      type: "chat" as const,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    const laterNode = {
      id: "node-later",
      nodeId: "node-later",
      label: "B1",
      topicId: topic.id,
      parentId: null,
      parentIds: [rootNode.id],
      title: "あとで：元のタイトル",
      summary: "あとで：元のタイトル",
      type: "later" as const,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    const promotedNode = {
      ...laterNode,
      parentId: rootNode.id,
      title: "編集後の質問",
      summary: "編集後の質問",
      type: "chat" as const,
      updatedAt: new Date().toISOString(),
      messages: [
        { role: "user" as const, content: "編集後の質問", createdAt: now },
        { role: "assistant" as const, content: "回答メッセージ", createdAt: now },
      ],
    };

    api.getToken.mockReturnValue("token");
    api.listTopics.mockResolvedValue({ items: [topic] });
    const listNodesResponses = [{ items: [rootNode, laterNode] }, { items: [rootNode, promotedNode] }];
    api.listNodes.mockImplementation(async () => listNodesResponses.shift() ?? { items: [] });
    api.postChat.mockResolvedValue({ node: promotedNode });

    render(<App />);

    await waitFor(() => expect(api.listNodes).toHaveBeenCalled());

    const laterButton = (await screen.findAllByTestId("gitk-node")).find(
      (el) => el.getAttribute("data-node-id") === "node-later"
    );
    expect(laterButton).toBeTruthy();
    await userEvent.click(laterButton!);

    const textarea = screen.getByPlaceholderText("わからないことをAIに質問する") as HTMLTextAreaElement;
    expect(textarea.value).toBe("元のタイトル");

    await userEvent.clear(textarea);
    await userEvent.type(textarea, "編集後の質問");

    const sendButton = screen.getByRole("button", { name: "送信" });
    await userEvent.click(sendButton);

    await waitFor(() =>
      expect(api.postChat).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: laterNode.id,
          topicId: topic.id,
          baseNodeId: rootNode.id,
          message: "編集後の質問",
        })
      )
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("gitk-node").length).toBe(2);
      expect(document.querySelectorAll(".gitk-node.later").length).toBe(0);
      const bubbles = document.querySelectorAll(".bubble-flat");
      expect(bubbles.length).toBe(2);
      const userBubble = document.querySelector(".bubble-flat.user .bubble-content");
      const assistantBubble = document.querySelector(".bubble-flat.assistant .bubble-content");
      expect(userBubble?.textContent).toContain("編集後の質問");
      expect(assistantBubble?.textContent).toContain("回答メッセージ");
    });
  });
});
