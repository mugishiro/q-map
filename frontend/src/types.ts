export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type Topic = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Node = {
  id: string;
  label: string;
  topicId: string;
  parentId: string | null;
  parentIds?: string[];
  title: string;
  summary: string;
  type: "chat" | "later";
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
};

export type UserSettings = {
  llmProvider: "openai" | "anthropic" | "gemini" | "openrouter" | "local" | null;
  model: string | null;
  apiKeyMasked: string | null;
};

export type TopicListResponse = {
  items: Topic[];
  nextCursor: string | null;
};

export type NodesResponse = {
  items: Node[];
};

export type PathResponse = {
  topicId: string;
  path: Node[];
};
