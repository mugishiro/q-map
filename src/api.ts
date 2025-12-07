import { ChatMessage, Node, NodesResponse, PathResponse, Topic, TopicListResponse, UserSettings } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const authHeader = () => {
  const token = localStorage.getItem("qmap_token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
};

export const api = {
  setToken(token: string) {
    localStorage.setItem("qmap_token", token);
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
    return handleResponse(res);
  },
  async getNodePath(nodeId: string): Promise<PathResponse> {
    const res = await fetch(`${API_BASE}/v1/nodes/${encodeURIComponent(nodeId)}/path`, {
      headers: { ...authHeader() },
    });
    return handleResponse(res);
  },
  async postChat(params: { topicId: string; message: string; baseNodeId?: string; label?: string }) {
    const res = await fetch(`${API_BASE}/v1/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader() },
      body: JSON.stringify(params),
    });
    return handleResponse<{ node: Node }>(res);
  },
  async createLaterNode(params: { topicId: string; parentId: string; summary: string; label?: string }) {
    const res = await fetch(`${API_BASE}/v1/nodes`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader() },
      body: JSON.stringify(params),
    });
    return handleResponse<Node>(res);
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
