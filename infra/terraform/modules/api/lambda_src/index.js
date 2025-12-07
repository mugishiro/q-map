"use strict";

// doc/API.md に沿ったルートのスタブ実装。
// まだ永続化や LLM 呼び出しはなく、固定レスポンスを返すだけ。

const json = (status, payload) => ({
  statusCode: status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});

const notFound = () =>
  json(404, { error: { code: "NOT_FOUND", message: "Route not found." } });

const unauthorized = () =>
  json(401, { error: { code: "UNAUTHENTICATED", message: "Missing auth." } });

const parseBody = (event) => {
  if (!event.body) return null;
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
};

const getUserId = (event) =>
  event?.requestContext?.authorizer?.jwt?.claims?.sub ?? null;

const matchPath = (path, pattern) => {
  // pattern: /v1/topics/{topicId}/nodes
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/\//g, "\\/")
        .replace(/\{[^/]+?\}/g, "([^/]+)") +
      "$"
  );
  const m = path.match(regex);
  if (!m) return null;
  const keys = [...pattern.matchAll(/\{([^/]+?)\}/g)].map((p) => p[1]);
  const params = {};
  keys.forEach((k, idx) => (params[k] = m[idx + 1]));
  return params;
};

exports.handler = async (event) => {
  const method = event?.requestContext?.http?.method ?? "UNKNOWN";
  const path = event?.rawPath ?? "/";
  const requestId = event?.requestContext?.requestId ?? "";
  const userId = getUserId(event);

  if (!userId) {
    return unauthorized();
  }

  // 固定のダミーデータ（doc/USER_FLOW.md の例をベース）
  const topic = {
    id: "t-web-sec",
    name: "Webセキュリティ",
    createdAt: "2025-12-07T12:00:00Z",
    updatedAt: "2025-12-07T12:10:00Z",
  };
  const nodes = [
    {
      id: "01HF...A1",
      label: "A1",
      topicId: topic.id,
      parentId: null,
      title: "XSSって何？",
      summary: "XSSって何？",
      type: "chat",
      createdAt: "2025-12-07T12:01:00Z",
      updatedAt: "2025-12-07T12:01:10Z",
      messages: [
        { role: "user", content: "XSSって何？", createdAt: "..." },
        { role: "assistant", content: "XSSとは...", createdAt: "..." },
      ],
    },
    {
      id: "01HF...B1",
      label: "B1",
      topicId: topic.id,
      parentId: "01HF...A1",
      title: "具体例を教えて",
      summary: "XSSの具体例について質問",
      type: "chat",
      createdAt: "2025-12-07T12:05:00Z",
      updatedAt: "2025-12-07T12:05:08Z",
      messages: [
        { role: "user", content: "具体例を教えて", createdAt: "..." },
        { role: "assistant", content: "例えば、掲示板に...", createdAt: "..." },
      ],
    },
    {
      id: "01HF...B2",
      label: "B2",
      topicId: topic.id,
      parentId: "01HF...A1",
      title: "あとで: SQL Injection について",
      summary: "SQL Injection について",
      type: "later",
      createdAt: "2025-12-07T12:15:00Z",
      updatedAt: "2025-12-07T12:15:00Z",
      messages: [],
    },
  ];

  // ルーティング
  // GET /v1/topics
  if (method === "GET" && path === "/v1/topics") {
    return json(200, { items: [topic], nextCursor: null, requestId, userId });
  }

  // POST /v1/topics
  if (method === "POST" && path === "/v1/topics") {
    const body = parseBody(event);
    return json(201, {
      id: "t-new",
      name: body?.name ?? "新規トピック",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requestId,
      userId,
    });
  }

  // GET /v1/topics/{topicId}
  const mTopic = matchPath(path, "/v1/topics/{topicId}");
  if (method === "GET" && mTopic && path.includes("/nodes") === false) {
    return json(200, topic);
  }

  // DELETE /v1/topics/{topicId}
  if (method === "DELETE" && mTopic) {
    return { statusCode: 204 };
  }

  // GET /v1/topics/{topicId}/nodes
  const mTopicNodes = matchPath(path, "/v1/topics/{topicId}/nodes");
  if (method === "GET" && mTopicNodes) {
    const includeMessages = event?.queryStringParameters?.includeMessages === "true";
    const items = includeMessages
      ? nodes
      : nodes.map(({ messages, ...rest }) => rest);
    return json(200, { items });
  }

  // POST /v1/topics/{topicId}/summary
  const mSummary = matchPath(path, "/v1/topics/{topicId}/summary");
  if (method === "POST" && mSummary) {
    return json(200, {
      topicId: mSummary.topicId,
      summary: "このトピックでは XSS の概要と具体例を扱いました（スタブ）。",
    });
  }

  // GET /v1/nodes/{nodeId}
  const mNode = matchPath(path, "/v1/nodes/{nodeId}");
  if (method === "GET" && mNode && !path.endsWith("/path")) {
    const found = nodes.find((n) => n.id === mNode.nodeId) ?? nodes[0];
    return json(200, found);
  }

  // GET /v1/nodes/{nodeId}/path
  const mNodePath = matchPath(path, "/v1/nodes/{nodeId}/path");
  if (method === "GET" && mNodePath) {
    return json(200, {
      topicId: topic.id,
      path: nodes
        .filter((n) => n.parentId === null || n.id === "01HF...B1") // A1 と B1 を例として返す
        .map((n) => ({ ...n, messages: n.messages ?? [] })),
    });
  }

  // POST /v1/nodes (later)
  if (method === "POST" && path === "/v1/nodes") {
    const body = parseBody(event);
    return json(201, {
      id: "01HF...NEW",
      label: "B3",
      topicId: body?.topicId ?? topic.id,
      parentId: body?.parentId ?? "01HF...A1",
      title: `あとで: ${body?.summary ?? "追加質問"}`,
      summary: body?.summary ?? "",
      type: "later",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // PATCH /v1/nodes/{nodeId}
  if (method === "PATCH" && mNode) {
    const body = parseBody(event) ?? {};
    return json(200, {
      ...nodes[0],
      id: mNode.nodeId,
      title: body.title ?? nodes[0].title,
      summary: body.summary ?? nodes[0].summary,
      updatedAt: new Date().toISOString(),
    });
  }

  // POST /v1/chat
  if (method === "POST" && path === "/v1/chat") {
    const body = parseBody(event) ?? {};
    return json(200, {
      node: {
        id: "01HF...NEWCHAT",
        label: "B4",
        topicId: body.topicId ?? topic.id,
        parentId: body.baseNodeId ?? "01HF...A1",
        title: body.message ?? "質問",
        summary: body.message ?? "質問",
        type: "chat",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          { role: "user", content: body.message ?? "", createdAt: new Date().toISOString() },
          { role: "assistant", content: "（スタブ応答）", createdAt: new Date().toISOString() },
        ],
      },
    });
  }

  return notFound();
};
