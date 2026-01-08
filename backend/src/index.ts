"use strict";

import AWS from "aws-sdk";
import crypto from "crypto";
import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";

type Role = "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
  createdAt: string;
}

interface TopicItem {
  userId: string;
  topicId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface NodeItem {
  topicId: string;
  nodeId: string;
  userId: string;
  parentId?: string;
  label?: string;
  title?: string;
  summary?: string;
  type?: string;
  messages?: Message[];
  createdAt: string;
  updatedAt: string;
}

interface UserSettings {
  userId: string;
  apiKeyEncrypted?: string;
  llmProvider?: LLMProvider;
  model?: string;
}

type LLMProvider = "openai" | "openrouter" | "anthropic" | "gemini";

class AppError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const ddb = new AWS.DynamoDB.DocumentClient({ region: process.env.REGION });
const kms = new AWS.KMS({ region: process.env.REGION });

const TOPICS_TABLE = process.env.TOPICS_TABLE_NAME ?? "";
const NODES_TABLE = process.env.NODES_TABLE_NAME ?? "";
const USER_SETTINGS_TABLE = process.env.USER_SETTINGS_TABLE_NAME ?? "";
const NODES_GSI1 = process.env.NODES_GSI1_NAME ?? ""; // parentId/createdAt
const NODES_GSI2 = process.env.NODES_GSI2_NAME ?? ""; // userId/updatedAt
const KMS_KEY_ARN = process.env.KMS_KEY_ARN ?? "";

const json = (status: number, payload: unknown): APIGatewayProxyResultV2 => ({
  statusCode: status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});

const error = (code: string, message: string, status = 400): APIGatewayProxyResultV2 =>
  json(status, { error: { code, message } });

const parseBody = <T>(event: APIGatewayProxyEventV2WithJWTAuthorizer): T => {
  if (!event.body) return {} as T;
  try {
    return JSON.parse(event.body) as T;
  } catch {
    return {} as T;
  }
};

const getUserId = (event: APIGatewayProxyEventV2WithJWTAuthorizer): string | null => {
  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
  return typeof sub === "string" ? sub : null;
};

const matchPath = (path: string, pattern: string): Record<string, string> | null => {
  const regex = new RegExp(
    "^" + pattern.replace(/\//g, "\\/").replace(/\{[^/]+?\}/g, "([^/]+)") + "$"
  );
  const m = path.match(regex);
  if (!m) return null;
  const keys = [...pattern.matchAll(/\{([^/]+?)\}/g)].map((p) => p[1]);
  const params: Record<string, string> = {};
  keys.forEach((k, idx) => {
    params[k] = m[idx + 1];
  });
  return params;
};

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const letterForDepth = (depth: number) => {
  const base = "A".charCodeAt(0);
  const code = Math.min(base + depth, "Z".charCodeAt(0));
  return String.fromCharCode(code);
};

const API_KEY_CACHE_TTL_MS = Number(process.env.LLM_API_KEY_CACHE_TTL_MS) || 5 * 60 * 1000;
interface ApiKeyCacheEntry {
  apiKey: string;
  expiresAt: number;
}
const apiKeyCache = new Map<string, ApiKeyCacheEntry>();

const getCachedApiKey = (userId: string) => {
  const entry = apiKeyCache.get(userId);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    apiKeyCache.delete(userId);
    return null;
  }
  return entry.apiKey;
};

const cacheApiKey = (userId: string, apiKey: string) => {
  apiKeyCache.set(userId, { apiKey, expiresAt: Date.now() + API_KEY_CACHE_TTL_MS });
};

const resolveApiKey = async (userId: string, ciphertext: string) => {
  const cached = getCachedApiKey(userId);
  if (cached) return cached;
  const plaintext = await decryptApiKey(ciphertext);
  cacheApiKey(userId, plaintext);
  return plaintext;
};

const maskApiKey = (apiKey: string) => {
  if (!apiKey) return null;
  if (apiKey.length <= 6) return "******";
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-2)}`;
};

const encryptApiKey = async (apiKey: string) => {
  if (!KMS_KEY_ARN) {
    throw new AppError("KMS_KEY_MISSING", "KMS_KEY_ARN is not configured.", 500);
  }
  const res = await kms
    .encrypt({
      KeyId: KMS_KEY_ARN,
      Plaintext: apiKey,
    })
    .promise();
  return res.CiphertextBlob?.toString("base64") ?? "";
};

const countChildren = async (topicId: string, parentId: string | null, userId: string) => {
  if (!parentId) {
    // ルート直下: topic 全件から parentId=null をフィルタ
    const res = await ddb
      .query({
        TableName: NODES_TABLE,
        KeyConditionExpression: "topicId = :t",
        ExpressionAttributeValues: { ":t": topicId },
      })
      .promise();
    const items = (res.Items as NodeItem[]) ?? [];
    return items.filter((n) => n.userId === userId && !n.parentId).length;
  }
  const res = await ddb
    .query({
        TableName: NODES_TABLE,
        IndexName: NODES_GSI1,
        KeyConditionExpression: "parentId = :p",
        FilterExpression: "topicId = :t",
        ExpressionAttributeValues: { ":p": parentId, ":t": topicId },
      })
    .promise();
  const items = (res.Items as NodeItem[]) ?? [];
  return items.filter((n) => n.userId === userId && n.topicId === topicId).length;
};

const generateLabel = async (topicId: string, parentId: string | null, userId: string) => {
  let depth = 0;
  if (parentId) {
    const parent = await getNode(topicId, parentId);
    if (parent && parent.userId === userId) {
      const path = await buildPath(userId, parent);
      depth = path.length; // 0-based: root=0, child=1...
    }
  }
  const siblings = await countChildren(topicId, parentId ?? null, userId);
  const letter = letterForDepth(depth);
  const number = siblings + 1;
  return `${letter}${number}`;
};

const decodeCursor = (cursor?: string | null) => {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    return undefined;
  }
};

const queryTopics = async (userId: string, limit: number, cursor?: string | null) => {
  const params: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: TOPICS_TABLE,
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": userId },
    Limit: limit || 50,
  };
  const exclusive = decodeCursor(cursor);
  if (exclusive) params.ExclusiveStartKey = exclusive;
  const res = await ddb.query(params).promise();
  return {
    items: (res.Items as TopicItem[]) ?? [],
    nextCursor: res.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64")
      : null,
  };
};

const getTopic = async (userId: string, topicId: string) => {
  const res = await ddb
    .get({ TableName: TOPICS_TABLE, Key: { userId, topicId } })
    .promise();
  return (res.Item as TopicItem | undefined) ?? null;
};

const deleteTopicWithNodes = async (userId: string, topicId: string) => {
  // Delete Topic
  await ddb.delete({ TableName: TOPICS_TABLE, Key: { userId, topicId } }).promise();
  // Delete Nodes by topicId (batch)
  let lastKey: AWS.DynamoDB.DocumentClient.Key | undefined;
  do {
    const res = await ddb
      .query({
        TableName: NODES_TABLE,
        KeyConditionExpression: "topicId = :t",
        ExpressionAttributeValues: { ":t": topicId },
        ExclusiveStartKey: lastKey,
      })
      .promise();
    const items = (res.Items as NodeItem[]) ?? [];
    if (items.length) {
      const batches: NodeItem[][] = [];
      for (let i = 0; i < items.length; i += 25) {
        batches.push(items.slice(i, i + 25));
      }
      for (const batch of batches) {
        await ddb
          .batchWrite({
            RequestItems: {
              [NODES_TABLE]: batch.map((i) => ({
                DeleteRequest: { Key: { topicId: i.topicId, nodeId: i.nodeId } },
              })),
            },
          })
          .promise();
      }
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
};

const queryNodesByTopic = async (userId: string, topicId: string) => {
  let lastKey: AWS.DynamoDB.DocumentClient.Key | undefined;
  const items: NodeItem[] = [];
  do {
    const res = await ddb
      .query({
        TableName: NODES_TABLE,
        KeyConditionExpression: "topicId = :t",
        ExpressionAttributeValues: { ":t": topicId },
        ExclusiveStartKey: lastKey,
      })
      .promise();
    if (res.Items) items.push(...(res.Items as NodeItem[]));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  // Filter by userId for safety and order deterministically
  const filtered = items.filter((n) => n.userId === userId);
  return filtered.sort((a, b) => {
    if (a.createdAt === b.createdAt) return a.nodeId < b.nodeId ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
};

const findNodeById = async (userId: string, nodeId: string) => {
  // GSI2 で userId 絞り込み + nodeId フィルタ
  if (NODES_GSI2) {
    const res = await ddb
      .query({
        TableName: NODES_TABLE,
        IndexName: NODES_GSI2,
        KeyConditionExpression: "userId = :u",
        FilterExpression: "nodeId = :n",
        ExpressionAttributeValues: { ":u": userId, ":n": nodeId },
      })
      .promise();
    const items = (res.Items as NodeItem[]) ?? [];
    if (items[0]) return items[0];
  }

  // フォールバック: topicId は分からないが nodeId はユニーク前提なので、Scan は避け BatchGet/Query を優先する。
  // まず topics を取得し、それぞれの topicId + nodeId で Get を試みる。
  const topicsRes = await ddb
    .query({
      TableName: TOPICS_TABLE,
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": userId },
      ProjectionExpression: "topicId",
    })
    .promise();
  const topics = (topicsRes.Items as TopicItem[]) ?? [];
  for (const t of topics) {
    const item = await getNode(t.topicId, nodeId);
    if (item && item.userId === userId) return item;
  }
  return null;
};

const getNode = async (topicId: string, nodeId: string) => {
  const res = await ddb
    .get({ TableName: NODES_TABLE, Key: { topicId, nodeId } })
    .promise();
  return (res.Item as NodeItem | undefined) ?? null;
};

const buildPath = async (userId: string, startNode: NodeItem) => {
  const path: NodeItem[] = [];
  let current: NodeItem | null = startNode;
  const visited = new Set<string>();
  const MAX_HOPS = 1000;
  let hops = 0;
  while (current) {
    if (visited.has(current.nodeId) || hops >= MAX_HOPS) {
      break;
    }
    visited.add(current.nodeId);
    path.push(current);
    hops += 1;
    if (!current.parentId) break;
    const parent = await getNode(current.topicId, current.parentId);
    if (!parent || parent.userId !== userId) break;
    current = parent;
  }
  return path.reverse();
};

const readUserSettings = async (userId: string) => {
  const res = await ddb
    .get({ TableName: USER_SETTINGS_TABLE, Key: { userId } })
    .promise();
  return (res.Item as UserSettings | undefined) ?? null;
};

const decryptApiKey = async (ciphertext: string) => {
  const res = await kms
    .decrypt({ CiphertextBlob: Buffer.from(ciphertext, "base64") })
    .promise();
  return res.Plaintext?.toString("utf8") ?? "";
};

const mapMessagesForAnthropic = (messages: Message[]) =>
  messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: [{ type: "text", text: m.content }],
  }));

const mapMessagesForGemini = (messages: Message[]) =>
  messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

const ALLOWED_LLM_PROVIDERS: LLMProvider[] = ["openai", "openrouter", "anthropic", "gemini"];

const fetchWithTimeout = async (input: RequestInfo, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

const saveUserSettings = async (userId: string, input: { llmProvider: LLMProvider; model: string; apiKey: string }) => {
  if (!ALLOWED_LLM_PROVIDERS.includes(input.llmProvider)) {
    throw new AppError("INVALID_PROVIDER", "Unsupported LLM provider", 400);
  }
  if (!input.model) throw new AppError("INVALID_MODEL", "model is required", 400);
  if (!input.apiKey) throw new AppError("LLM_API_KEY_MISSING", "apiKey is required", 400);

  const apiKeyEncrypted = await encryptApiKey(input.apiKey);
  const now = nowIso();
  cacheApiKey(userId, input.apiKey);
  await ddb
    .put({
      TableName: USER_SETTINGS_TABLE,
      Item: {
        userId,
        llmProvider: input.llmProvider,
        model: input.model,
        apiKeyEncrypted,
        updatedAt: now,
      },
    })
    .promise();
  return { llmProvider: input.llmProvider, model: input.model, apiKeyMasked: maskApiKey(input.apiKey) };
};

const callLLM = async (userId: string, messages: Message[]): Promise<Message> => {
  const settings = await readUserSettings(userId);
  if (!settings || !settings.apiKeyEncrypted) {
    throw new AppError("LLM_API_KEY_MISSING", "LLM API key is not configured.", 400);
  }
  const apiKey = await resolveApiKey(userId, settings.apiKeyEncrypted);
  const provider: LLMProvider = settings.llmProvider || "openai";
  const model = settings.model || "gpt-4o-mini";
  const timeoutMs = 30_000;

  if (provider === "openai") {
    const payload = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };
    const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    }, timeoutMs);
    if (!res.ok) {
      const text = await res.text();
      throw new AppError("LLM_REQUEST_FAILED", text || "LLM request failed", 502);
    }
    const data = (await res.json()) as any;
    const content = data?.choices?.[0]?.message?.content ?? "(empty response)";
    return { role: "assistant", content, createdAt: nowIso() };
  }

  if (provider === "openrouter") {
    const payload = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };
    const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    }, timeoutMs);
    if (!res.ok) {
      const text = await res.text();
      throw new AppError("LLM_REQUEST_FAILED", text || "LLM request failed", 502);
    }
    const data = (await res.json()) as any;
    const content = data?.choices?.[0]?.message?.content ?? "(empty response)";
    return { role: "assistant", content, createdAt: nowIso() };
  }

  if (provider === "anthropic") {
    const payload = {
      model,
      max_tokens: 1024,
      messages: mapMessagesForAnthropic(messages),
    };
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    }, timeoutMs);
    if (!res.ok) {
      const text = await res.text();
      throw new AppError("LLM_REQUEST_FAILED", text || "LLM request failed", 502);
    }
    const data = (await res.json()) as any;
    const content = data?.content?.[0]?.text ?? "(empty response)";
    return { role: "assistant", content, createdAt: nowIso() };
  }

  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;
    const payload = { contents: mapMessagesForGemini(messages) };
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }, timeoutMs);
    if (!res.ok) {
      const text = await res.text();
      throw new AppError("LLM_REQUEST_FAILED", text || "LLM request failed", 502);
    }
    const data = (await res.json()) as any;
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "(empty response)";
    return { role: "assistant", content, createdAt: nowIso() };
  }

  throw new AppError("LLM_PROVIDER_NOT_SUPPORTED", `Provider ${provider} not supported.`, 400);
};

const ensureBody = <T extends Record<string, unknown>>(body: T, keys: (keyof T)[]): boolean => {
  return keys.every((k) => Boolean(body[k]));
};

const normalizeNodeType = (node: NodeItem, hasMessages: boolean): NodeItem => {
  if (node.type) return node;
  if (hasMessages && node.messages && node.messages.length > 0) {
    return { ...node, type: "chat" };
  }
  return { ...node, type: "later" };
};

const attachParentId = <T extends { parentId?: string }>(item: T, parentId?: string | null): T => {
  const next = { ...item };
  if (parentId) {
    next.parentId = parentId;
  } else {
    delete next.parentId;
  }
  return next;
};

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const method = event?.requestContext?.http?.method ?? "UNKNOWN";
  const rawPath = event?.rawPath ?? "/";
  const stagePrefix = process.env.STAGE ? `/${process.env.STAGE}` : "";
  // Allow both /v1/... and /{stage}/v1/... (e.g., when API Gateway stage is part of the path)
  const path =
    stagePrefix && rawPath.startsWith(stagePrefix) ? rawPath.slice(stagePrefix.length) || "/" : rawPath;
  const userId = getUserId(event);

  if (!userId) {
    return error("UNAUTHENTICATED", "Missing auth", 401);
  }

  try {
    // GET /v1/me/settings
    if (method === "GET" && path === "/v1/me/settings") {
      const settings = await readUserSettings(userId);
      const apiKeyMasked = settings?.apiKeyEncrypted
        ? maskApiKey(await resolveApiKey(userId, settings.apiKeyEncrypted))
        : null;
      return json(200, {
        llmProvider: settings?.llmProvider || null,
        model: settings?.model || null,
        apiKeyMasked,
      });
    }

    // POST /v1/me/settings
    if (method === "POST" && path === "/v1/me/settings") {
      const body = parseBody<{ llmProvider?: LLMProvider; model?: string; apiKey?: string }>(event);
      if (!ensureBody(body, ["llmProvider", "model", "apiKey"])) {
        return error("VALIDATION_ERROR", "llmProvider, model, apiKey are required");
      }
      const result = await saveUserSettings(userId, {
        llmProvider: body.llmProvider as LLMProvider,
        model: body.model as string,
        apiKey: body.apiKey as string,
      });
      return json(200, result);
    }

    // GET /v1/topics
    if (method === "GET" && path === "/v1/topics") {
      const limit = parseInt(event?.queryStringParameters?.limit || "50", 10);
      const cursor = event?.queryStringParameters?.cursor;
      const result = await queryTopics(userId, limit, cursor);
      return json(200, result);
    }

    // POST /v1/topics
    if (method === "POST" && path === "/v1/topics") {
      const body = parseBody<{ name?: string }>(event);
      if (!body.name) return error("VALIDATION_ERROR", "name is required");
      const topicId = `topic#${newId()}`;
      const now = nowIso();
      const item: TopicItem = { userId, topicId, name: body.name, createdAt: now, updatedAt: now };
      await ddb.put({ TableName: TOPICS_TABLE, Item: item }).promise();
      return json(201, { id: topicId, name: body.name, createdAt: now, updatedAt: now });
    }

    // GET /v1/topics/{topicId}
    const mTopic = matchPath(path, "/v1/topics/{topicId}");
    if (method === "GET" && mTopic && !path.includes("/nodes")) {
      const item = await getTopic(userId, mTopic.topicId);
      if (!item) return error("TOPIC_NOT_FOUND", "Topic not found", 404);
      return json(200, {
        id: item.topicId,
        name: item.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }

    // PATCH /v1/topics/{topicId}
    if (method === "PATCH" && mTopic && !path.includes("/nodes") && !path.endsWith("/summary")) {
      const body = parseBody<{ name?: string }>(event);
      const nextName = body.name?.trim();
      if (!nextName) return error("VALIDATION_ERROR", "name is required");
      const item = await getTopic(userId, mTopic.topicId);
      if (!item) return error("TOPIC_NOT_FOUND", "Topic not found", 404);
      const now = nowIso();
      await ddb
        .update({
          TableName: TOPICS_TABLE,
          Key: { userId, topicId: mTopic.topicId },
          UpdateExpression: "SET #name = :name, updatedAt = :updatedAt",
          ExpressionAttributeNames: { "#name": "name" },
          ExpressionAttributeValues: { ":name": nextName, ":updatedAt": now },
        })
        .promise();
      return json(200, { id: item.topicId, name: nextName, createdAt: item.createdAt, updatedAt: now });
    }

    // DELETE /v1/topics/{topicId}
    if (method === "DELETE" && mTopic) {
      const item = await getTopic(userId, mTopic.topicId);
      if (!item) return error("TOPIC_NOT_FOUND", "Topic not found", 404);
      await deleteTopicWithNodes(userId, mTopic.topicId);
      return { statusCode: 204 };
    }

    // GET /v1/topics/{topicId}/nodes
    const mTopicNodes = matchPath(path, "/v1/topics/{topicId}/nodes");
    if (method === "GET" && mTopicNodes) {
      const includeMessages = event?.queryStringParameters?.includeMessages === "true";
      const items = await queryNodesByTopic(userId, mTopicNodes.topicId);
      const mapped = includeMessages
        ? items.map((n) => normalizeNodeType(n, true))
        : items.map((n) => {
            if (n.type) return n;
            return { ...n, type: "later" };
          });
      return json(200, { items: mapped });
    }

    // POST /v1/topics/{topicId}/summary
    const mSummary = matchPath(path, "/v1/topics/{topicId}/summary");
    if (method === "POST" && mSummary) {
      const items = await queryNodesByTopic(userId, mSummary.topicId);
      const summaries = items.map((n) => `- ${n.label || n.nodeId}: ${n.summary || n.title}`).join("\n");
      return json(200, { topicId: mSummary.topicId, summary: summaries || "データがありません。" });
    }

    // POST /v1/nodes (later)
    if (method === "POST" && path === "/v1/nodes") {
      const body = parseBody<{ topicId?: string; parentId?: string | null; summary?: string; label?: string }>(event);
      if (!ensureBody(body, ["topicId", "summary"]))
        return error("VALIDATION_ERROR", "topicId and summary are required");
      const topic = await getTopic(userId, body.topicId!);
      if (!topic) return error("TOPIC_NOT_FOUND", "Topic not found", 404);
      if (body.parentId) {
        const parent = await getNode(body.topicId!, body.parentId);
        if (!parent || parent.userId !== userId) return error("PARENT_NOT_FOUND", "Parent node not found", 404);
        if (parent.topicId !== body.topicId) {
          return error("PARENT_TOPIC_MISMATCH", "Parent node does not belong to the topic", 400);
        }
        if (parent.type === "later") {
          return error("PARENT_NOT_ALLOWED", "Cannot add later node under another later node", 400);
        }
      }
      const now = nowIso();
      const nodeId = `node#${newId()}`;
      const parentId = body.parentId ?? null;
      const label = body.label || (await generateLabel(body.topicId!, parentId, userId));
      const baseLater: NodeItem = {
        topicId: body.topicId!,
        nodeId,
        userId,
        label,
        title: body.summary,
        summary: body.summary,
        type: "later",
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      const item: NodeItem = attachParentId(baseLater, parentId);
      await ddb.put({ TableName: NODES_TABLE, Item: item }).promise();
      const { messages, ...rest } = item;
      return json(201, rest);
    }

    // GET /v1/nodes/{nodeId}
    const mNode = matchPath(path, "/v1/nodes/{nodeId}");
    if (method === "GET" && mNode && !path.endsWith("/path")) {
      const nodeId = decodeURIComponent(mNode.nodeId);
      const node = await findNodeById(userId, nodeId);
      if (!node) return error("NODE_NOT_FOUND", "Node not found", 404);
      return json(200, normalizeNodeType(node, true));
    }

    // GET /v1/nodes/{nodeId}/path
    const mNodePath = matchPath(path, "/v1/nodes/{nodeId}/path");
    if (method === "GET" && mNodePath) {
      const nodeId = decodeURIComponent(mNodePath.nodeId);
      const node = await findNodeById(userId, nodeId);
      if (!node) return error("NODE_NOT_FOUND", "Node not found", 404);
      const pathArr = await buildPath(userId, node);
      const normalizedPath = pathArr.map((n) => normalizeNodeType(n, true));
      return json(200, { topicId: node.topicId, path: normalizedPath });
    }

    // PATCH /v1/nodes/{nodeId}
    if (method === "PATCH" && mNode) {
      const body = parseBody<{ title?: string; summary?: string }>(event);
      const nodeId = decodeURIComponent(mNode.nodeId);
      const node = await findNodeById(userId, nodeId);
      if (!node) return error("NODE_NOT_FOUND", "Node not found", 404);
      const updates = {
        ":title": body.title ?? node.title,
        ":summary": body.summary ?? node.summary,
        ":updatedAt": nowIso(),
      };
      await ddb
        .update({
          TableName: NODES_TABLE,
          Key: { topicId: node.topicId, nodeId: node.nodeId },
          UpdateExpression: "SET title = :title, summary = :summary, updatedAt = :updatedAt",
          ExpressionAttributeValues: updates,
        })
        .promise();
      return json(200, {
        ...node,
        title: updates[":title"],
        summary: updates[":summary"],
        updatedAt: updates[":updatedAt"],
      });
    }

    // DELETE /v1/nodes/{nodeId}
    if (method === "DELETE" && mNode) {
      const nodeId = decodeURIComponent(mNode.nodeId);
      const node = await findNodeById(userId, nodeId);
      if (!node) return error("NODE_NOT_FOUND", "Node not found", 404);
      if (node.type !== "later") {
        return error("DELETE_NOT_ALLOWED", "Only later nodes can be deleted", 400);
      }
      await ddb
        .delete({
          TableName: NODES_TABLE,
          Key: { topicId: node.topicId, nodeId: node.nodeId },
        })
        .promise();
      return { statusCode: 204, body: "" };
    }

    // POST /v1/chat
    if (method === "POST" && path === "/v1/chat") {
      const body = parseBody<{
        topicId?: string;
        message?: string;
        baseNodeId?: string;
        label?: string;
        nodeId?: string; // reuse existing later node
      }>(event);
      if (!ensureBody(body, ["topicId", "message"]))
        return error("VALIDATION_ERROR", "topicId and message are required");

      const topic = await getTopic(userId, body.topicId!);
      if (!topic) return error("TOPIC_NOT_FOUND", "Topic not found", 404);

      const targetNode = body.nodeId ? await findNodeById(userId, body.nodeId) : null;
      if (body.nodeId && !targetNode) return error("NODE_NOT_FOUND", "target node not found", 404);
      if (targetNode && targetNode.topicId !== body.topicId) {
        return error("NODE_TOPIC_MISMATCH", "target node does not belong to the topic", 400);
      }

      let baseNode: NodeItem | null = null;
      if (body.baseNodeId) {
        baseNode = await findNodeById(userId, body.baseNodeId);
        if (!baseNode) return error("NODE_NOT_FOUND", "baseNode not found", 404);
        if (baseNode.topicId !== body.topicId) {
          return error("BASE_NODE_TOPIC_MISMATCH", "baseNode does not belong to the topic", 400);
        }
      } else if (targetNode?.parentId) {
        baseNode = await getNode(targetNode.topicId, targetNode.parentId);
        if (baseNode && baseNode.userId !== userId) baseNode = null;
      }

      // パスの messages を連結
      const history: Message[] = [];
      if (baseNode) {
        const pathArr = await buildPath(userId, baseNode);
        for (const n of pathArr) {
          (n.messages || []).forEach((m) => history.push(m));
        }
      }
      const userMessage: Message = { role: "user", content: body.message!, createdAt: nowIso() };
      history.push(userMessage);

      let assistantMsg: Message;
      try {
        assistantMsg = await callLLM(userId, history);
      } catch (err) {
        if (err instanceof AppError) {
          return error(err.code, err.message, err.status);
        }
        return error("LLM_REQUEST_FAILED", "LLM error", 502);
      }

      const now = nowIso();
      const storedMessages: Message[] = [
        { role: "user", content: body.message!, createdAt: now },
        assistantMsg,
      ];

      if (targetNode) {
        if (targetNode.type && targetNode.type !== "later") {
          return error("NODE_NOT_LATER", "target node is not a later node", 400);
        }
        await ddb
          .update({
            TableName: NODES_TABLE,
            Key: { topicId: targetNode.topicId, nodeId: targetNode.nodeId },
            UpdateExpression:
              "SET title = :title, summary = :summary, #type = :type, messages = :messages, updatedAt = :updatedAt",
            ExpressionAttributeValues: {
              ":title": body.message,
              ":summary": body.message,
              ":type": "chat",
              ":messages": storedMessages,
              ":updatedAt": now,
            },
            ExpressionAttributeNames: { "#type": "type" },
          })
          .promise();
        return json(200, {
          node: normalizeNodeType(
            {
              ...targetNode,
              title: body.message,
              summary: body.message,
              type: "chat",
              messages: storedMessages,
              updatedAt: now,
            },
            true
          ),
        });
      }

      const nodeId = `node#${newId()}`;
      const parentId = body.baseNodeId || null;
      const label = body.label || (await generateLabel(body.topicId!, parentId, userId));
      const baseChat: NodeItem = {
        topicId: body.topicId!,
        nodeId,
        userId,
        label,
        title: body.message,
        summary: body.message,
        type: "chat",
        messages: storedMessages,
        createdAt: now,
        updatedAt: now,
      };
      const nodeItem: NodeItem = attachParentId(baseChat, parentId);

      await ddb.put({ TableName: NODES_TABLE, Item: nodeItem }).promise();
      return json(200, { node: normalizeNodeType(nodeItem, true) });
    }

    return error("NOT_FOUND", "Route not found", 404);
  } catch (e) {
    console.error("handler error", e);
    if (e instanceof AppError) {
      return error(e.code, e.message, e.status);
    }
    const message = e instanceof Error ? e.message : "unexpected error";
    return error("INTERNAL_SERVER_ERROR", message, 500);
  }
};

// テスト用に内部関数をエクスポート
export const _test = {
  letterForDepth,
  matchPath,
};

export default { handler, _test };
