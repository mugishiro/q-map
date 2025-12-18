import { ChatMessage, Node, NodesResponse, PathResponse, Topic, TopicListResponse, UserSettings } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const normalizeNode = (n: any): Node => {
  const id = n.nodeId ?? n.id;
  const type = n.type || (Array.isArray(n.messages) && n.messages.length > 0 ? "chat" : "later");
  return { ...n, id, type };
};

const authHeader = () => {
  const token = localStorage.getItem("qmap_token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

const handleResponse = async <T>(res: Response): Promise<T> => {
  const text = await res.text();
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    if (text) {
      try {
        const data = JSON.parse(text);
        message = data?.error?.message || data?.message || text || message;
      } catch {
        message = text || message;
      }
    }
    throw new Error(message);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
};

export const api = {
  setToken(token: string) {
    localStorage.setItem("qmap_token", token);
  },
  clearToken() {
    localStorage.removeItem("qmap_token");
  },
  getToken(): string | null {
    return localStorage.getItem("qmap_token");
  },
  async listTopics(): Promise<TopicListResponse> {
    const res = await fetch(`${API_BASE}/v1/topics`, { headers: { ...authHeader() } });
    return handleResponse(res);
  },
  async createTopic(name: string): Promise<Topic> {
    const res = await fetch(`${API_BASE}/v1/topics`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader() },
      body: JSON.stringify({ name }),
    });
    return handleResponse(res);
  },
  async deleteTopic(topicId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/v1/topics/${topicId}`, {
      method: "DELETE",
      headers: { ...authHeader() },
    });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
  },
  async listNodes(topicId: string, includeMessages = false): Promise<NodesResponse> {
    const res = await fetch(
      `${API_BASE}/v1/topics/${encodeURIComponent(topicId)}/nodes?includeMessages=${includeMessages}`,
      { headers: { ...authHeader() } }
    );
    const data = await handleResponse<NodesResponse>(res);
    return { ...data, items: data.items.map(normalizeNode) };
  },
  async getNodePath(nodeId: string): Promise<PathResponse> {
    const res = await fetch(`${API_BASE}/v1/nodes/${encodeURIComponent(nodeId)}/path`, {
      headers: { ...authHeader() },
    });
    const data = await handleResponse<PathResponse>(res);
    return { ...data, path: data.path.map(normalizeNode) };
  },
  async postChat(params: {
    topicId: string;
    message: string;
    baseNodeId?: string;
    label?: string;
    nodeId?: string;
  }) {
    const res = await fetch(`${API_BASE}/v1/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader() },
      body: JSON.stringify(params),
    });
    const data = await handleResponse<{ node: Node }>(res);
    return { node: normalizeNode(data.node) };
  },
  async createLaterNode(params: { topicId: string; parentId: string | null; summary: string; label?: string }) {
    const res = await fetch(`${API_BASE}/v1/nodes`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader() },
      body: JSON.stringify(params),
    });
    const data = await handleResponse<Node>(res);
    return normalizeNode(data);
  },
  async getSettings(): Promise<UserSettings> {
    const res = await fetch(`${API_BASE}/v1/me/settings`, { headers: { ...authHeader() } });
    return handleResponse(res);
  },
  async saveSettings(input: { llmProvider: string; model: string; apiKey: string }) {
    const res = await fetch(`${API_BASE}/v1/me/settings`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader() },
      body: JSON.stringify(input),
    });
    return handleResponse<UserSettings>(res);
  },
};
