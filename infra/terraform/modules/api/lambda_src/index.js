"use strict";

// QMap BFF 実装（シンプル版）
// - DynamoDB: Topics / Nodes / UserSettings
// - Cognito JWT (sub) を userId として利用
// - LLM: OpenAI chat/completions を呼び出すシンプル実装（apiKey は KMS 復号）
//
// 注意:
// - Node テーブルは PK=topicId, SK=nodeId。nodeId 単独取得は GSI2(userId/updatedAt) から絞り込みで解決。
// - label 生成は簡易。必要ならフロント側で再計算を検討。

const AWS = require("aws-sdk");
const crypto = require("crypto");

const ddb = new AWS.DynamoDB.DocumentClient({ region: process.env.REGION });
const kms = new AWS.KMS({ region: process.env.REGION });

const TOPICS_TABLE = process.env.TOPICS_TABLE_NAME;
const NODES_TABLE = process.env.NODES_TABLE_NAME;
const USER_SETTINGS_TABLE = process.env.USER_SETTINGS_TABLE_NAME;
const NODES_GSI2 = process.env.NODES_GSI2_NAME; // userId/updatedAt

const json = (status, payload) => ({
  statusCode: status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});

const error = (code, message, status = 400) =>
  json(status, { error: { code, message } });

const parseBody = (event) => {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (e) {
    return {};
  }
};

const getUserId = (event) =>
  event?.requestContext?.authorizer?.jwt?.claims?.sub ?? null;

const matchPath = (path, pattern) => {
  const regex = new RegExp(
    "^" + pattern.replace(/\//g, "\\/").replace(/\{[^/]+?\}/g, "([^/]+)") + "$"
  );
  const m = path.match(regex);
  if (!m) return null;
  const keys = [...pattern.matchAll(/\{([^/]+?)\}/g)].map((p) => p[1]);
  const params = {};
  keys.forEach((k, idx) => (params[k] = m[idx + 1]));
  return params;
};

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const newLabel = () => `N${Date.now().toString(36)}`;

const queryTopics = async (userId, limit, cursor) => {
  const params = {
    TableName: TOPICS_TABLE,
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": userId },
    Limit: limit || 50,
  };
  if (cursor) params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  const res = await ddb.query(params).promise();
  return {
    items: res.Items ?? [],
    nextCursor: res.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64")
      : null,
  };
};

const getTopic = async (userId, topicId) => {
  const res = await ddb
    .get({ TableName: TOPICS_TABLE, Key: { userId, topicId } })
    .promise();
  return res.Item || null;
};

const deleteTopicWithNodes = async (userId, topicId) => {
  // Delete Topic
  await ddb.delete({ TableName: TOPICS_TABLE, Key: { userId, topicId } }).promise();
  // Delete Nodes by topicId (batch)
  let lastKey;
  do {
    const res = await ddb
      .query({
        TableName: NODES_TABLE,
        KeyConditionExpression: "topicId = :t",
        ExpressionAttributeValues: { ":t": topicId },
        ExclusiveStartKey: lastKey,
      })
      .promise();
    const items = res.Items ?? [];
    if (items.length) {
      const batches = [];
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

const queryNodesByTopic = async (userId, topicId) => {
  const res = await ddb
    .query({
      TableName: NODES_TABLE,
      KeyConditionExpression: "topicId = :t",
      ExpressionAttributeValues: { ":t": topicId },
    })
    .promise();
  // Filter by userId for safety
  return (res.Items ?? []).filter((n) => n.userId === userId);
};

const findNodeById = async (userId, nodeId) => {
  // Query GSI2: userId/updatedAt と FilterExpression で nodeId を絞り込む
  const res = await ddb
    .query({
      TableName: NODES_TABLE,
      IndexName: NODES_GSI2,
      KeyConditionExpression: "userId = :u",
      FilterExpression: "nodeId = :n",
      ExpressionAttributeValues: { ":u": userId, ":n": nodeId },
      Limit: 1,
    })
    .promise();
  const items = res.Items ?? [];
  return items[0] || null;
};

const getNode = async (topicId, nodeId) => {
  const res = await ddb
    .get({ TableName: NODES_TABLE, Key: { topicId, nodeId } })
    .promise();
  return res.Item || null;
};

const buildPath = async (userId, startNode) => {
  const path = [];
  let current = startNode;
  while (current) {
    path.push(current);
    if (!current.parentId) break;
    const parent = await getNode(current.topicId, current.parentId);
    if (!parent || parent.userId !== userId) break;
    current = parent;
  }
  return path.reverse();
};

const readUserSettings = async (userId) => {
  const res = await ddb
    .get({ TableName: USER_SETTINGS_TABLE, Key: { userId } })
    .promise();
  return res.Item || null;
};

const decryptApiKey = async (ciphertext) => {
  const res = await kms
    .decrypt({ CiphertextBlob: Buffer.from(ciphertext, "base64") })
    .promise();
  return res.Plaintext.toString("utf8");
};

const callLLM = async (userId, messages) => {
  const settings = await readUserSettings(userId);
  if (!settings || !settings.apiKeyEncrypted) {
    throw { code: "LLM_API_KEY_MISSING", status: 400, message: "LLM API key is not configured." };
  }
  const apiKey = await decryptApiKey(settings.apiKeyEncrypted);
  const provider = settings.llmProvider || "openai";
  const model = settings.model || "gpt-4o-mini";

  if (provider !== "openai") {
    return {
      role: "assistant",
      content: `Provider ${provider} not implemented. Echo: ${messages.at(-1)?.content ?? ""}`,
      createdAt: nowIso(),
    };
  }

  const payload = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw { code: "LLM_REQUEST_FAILED", status: 502, message: text };
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "(empty response)";
  return { role: "assistant", content, createdAt: nowIso() };
};

const ensureBody = (body, keys) => {
  for (const k of keys) {
    if (!body[k]) return false;
  }
  return true;
};

exports.handler = async (event) => {
  const method = event?.requestContext?.http?.method ?? "UNKNOWN";
  const path = event?.rawPath ?? "/";
  const userId = getUserId(event);

  if (!userId) {
    return error("UNAUTHENTICATED", "Missing auth", 401);
  }

  try {
    // GET /v1/topics
    if (method === "GET" && path === "/v1/topics") {
      const limit = parseInt(event?.queryStringParameters?.limit || "50", 10);
      const cursor = event?.queryStringParameters?.cursor;
      const result = await queryTopics(userId, limit, cursor);
      return json(200, result);
    }

    // POST /v1/topics
    if (method === "POST" && path === "/v1/topics") {
      const body = parseBody(event);
      if (!body.name) return error("VALIDATION_ERROR", "name is required");
      const topicId = `topic#${newId()}`;
      const now = nowIso();
      const item = { userId, topicId, name: body.name, createdAt: now, updatedAt: now };
      await ddb.put({ TableName: TOPICS_TABLE, Item: item }).promise();
      return json(201, { id: topicId, name: body.name, createdAt: now, updatedAt: now });
    }

    // GET /v1/topics/{topicId}
    const mTopic = matchPath(path, "/v1/topics/{topicId}");
    if (method === "GET" && mTopic && !path.includes("/nodes")) {
      const item = await getTopic(userId, mTopic.topicId);
      if (!item) return error("TOPIC_NOT_FOUND", "Topic not found", 404);
      return json(200, { id: item.topicId, name: item.name, createdAt: item.createdAt, updatedAt: item.updatedAt });
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
      const mapped = includeMessages ? items : items.map(({ messages, ...rest }) => rest);
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
      const body = parseBody(event);
      if (!ensureBody(body, ["topicId", "parentId", "summary"]))
        return error("VALIDATION_ERROR", "topicId, parentId, summary are required");
      const topic = await getTopic(userId, body.topicId);
      if (!topic) return error("TOPIC_NOT_FOUND", "Topic not found", 404);
      const now = nowIso();
      const nodeId = `node#${newId()}`;
      const item = {
        topicId: body.topicId,
        nodeId,
        userId,
        parentId: body.parentId,
        label: body.label || newLabel(),
        title: `あとで: ${body.summary}`,
        summary: body.summary,
        type: "later",
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      await ddb.put({ TableName: NODES_TABLE, Item: item }).promise();
      const { messages, ...rest } = item;
      return json(201, rest);
    }

    // GET /v1/nodes/{nodeId}
    const mNode = matchPath(path, "/v1/nodes/{nodeId}");
    if (method === "GET" && mNode && !path.endsWith("/path")) {
      const node = await findNodeById(userId, mNode.nodeId);
      if (!node) return error("NODE_NOT_FOUND", "Node not found", 404);
      return json(200, node);
    }

    // GET /v1/nodes/{nodeId}/path
    const mNodePath = matchPath(path, "/v1/nodes/{nodeId}/path");
    if (method === "GET" && mNodePath) {
      const node = await findNodeById(userId, mNodePath.nodeId);
      if (!node) return error("NODE_NOT_FOUND", "Node not found", 404);
      const pathArr = await buildPath(userId, node);
      return json(200, { topicId: node.topicId, path: pathArr });
    }

    // PATCH /v1/nodes/{nodeId}
    if (method === "PATCH" && mNode) {
      const body = parseBody(event);
      const node = await findNodeById(userId, mNode.nodeId);
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

    // POST /v1/chat
    if (method === "POST" && path === "/v1/chat") {
      const body = parseBody(event);
      if (!ensureBody(body, ["topicId", "message"]))
        return error("VALIDATION_ERROR", "topicId and message are required");

      const topic = await getTopic(userId, body.topicId);
      if (!topic) return error("TOPIC_NOT_FOUND", "Topic not found", 404);

      let baseNode = null;
      if (body.baseNodeId) {
        baseNode = await findNodeById(userId, body.baseNodeId);
        if (!baseNode) return error("NODE_NOT_FOUND", "baseNode not found", 404);
      }

      // パスの messages を連結
      const history = [];
      if (baseNode) {
        const pathArr = await buildPath(userId, baseNode);
        for (const n of pathArr) {
          (n.messages || []).forEach((m) => history.push(m));
        }
      }
      history.push({ role: "user", content: body.message, createdAt: nowIso() });

      let assistantMsg;
      try {
        assistantMsg = await callLLM(userId, history);
      } catch (err) {
        const status = err.status || 500;
        return error(err.code || "LLM_REQUEST_FAILED", err.message || "LLM error", status);
      }

      const now = nowIso();
      const nodeId = `node#${newId()}`;
      const nodeItem = {
        topicId: body.topicId,
        nodeId,
        userId,
        parentId: body.baseNodeId || null,
        label: body.label || newLabel(),
        title: body.message,
        summary: body.message,
        type: "chat",
        messages: [
          { role: "user", content: body.message, createdAt: now },
          assistantMsg,
        ],
        createdAt: now,
        updatedAt: now,
      };

      await ddb.put({ TableName: NODES_TABLE, Item: nodeItem }).promise();
      return json(200, { node: nodeItem });
    }

    return error("NOT_FOUND", "Route not found", 404);
  } catch (e) {
    console.error("handler error", e);
    return error("INTERNAL_SERVER_ERROR", e.message || "unexpected error", 500);
  }
};
