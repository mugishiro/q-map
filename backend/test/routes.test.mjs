import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory tables shared across mocked DocumentClient instances
const tables = (globalThis.__ddbTables = {
  TOPICS: [],
  NODES: [],
  USER_SETTINGS: [],
});

const now = () => new Date().toISOString();

vi.mock("aws-sdk", () => {
  class MockDocumentClient {
    query(params) {
      return {
        promise: async () => {
          if (params.TableName === process.env.TOPICS_TABLE_NAME) {
            const userId = params.ExpressionAttributeValues?.[":u"];
            const items = userId
              ? tables.TOPICS.filter((t) => t.userId === userId)
              : [...tables.TOPICS];
            return { Items: items };
          }
          if (params.TableName === process.env.NODES_TABLE_NAME) {
            const topicId = params.ExpressionAttributeValues?.[":t"];
            const parentId = params.ExpressionAttributeValues?.[":p"];
            let items = [...tables.NODES];
            if (topicId) items = items.filter((n) => n.topicId === topicId);
            if (parentId !== undefined) items = items.filter((n) => n.parentId === parentId);
            const userId = params.ExpressionAttributeValues?.[":u"];
            const nodeId = params.ExpressionAttributeValues?.[":n"];
            if (userId) items = items.filter((n) => n.userId === userId);
            if (nodeId) items = items.filter((n) => n.nodeId === nodeId);
            return { Items: items };
          }
          return { Items: [] };
        },
      };
    }
    get(params) {
      return {
        promise: async () => {
          if (params.TableName === process.env.TOPICS_TABLE_NAME) {
            const item = tables.TOPICS.find(
              (t) => t.userId === params.Key.userId && t.topicId === params.Key.topicId
            );
            return { Item: item };
          }
          if (params.TableName === process.env.NODES_TABLE_NAME) {
            const item = tables.NODES.find(
              (n) => n.topicId === params.Key.topicId && n.nodeId === params.Key.nodeId
            );
            return { Item: item };
          }
          if (params.TableName === process.env.USER_SETTINGS_TABLE_NAME) {
            const item = tables.USER_SETTINGS.find((u) => u.userId === params.Key.userId);
            return { Item: item };
          }
          return { Item: undefined };
        },
      };
    }
    put(params) {
      return {
        promise: async () => {
          if (params.TableName === process.env.TOPICS_TABLE_NAME) {
            const idx = tables.TOPICS.findIndex(
              (t) => t.userId === params.Item.userId && t.topicId === params.Item.topicId
            );
            if (idx >= 0) tables.TOPICS[idx] = params.Item;
            else tables.TOPICS.push(params.Item);
          }
          if (params.TableName === process.env.NODES_TABLE_NAME) {
            const idx = tables.NODES.findIndex(
              (n) => n.topicId === params.Item.topicId && n.nodeId === params.Item.nodeId
            );
            if (idx >= 0) tables.NODES[idx] = params.Item;
            else tables.NODES.push(params.Item);
          }
          if (params.TableName === process.env.USER_SETTINGS_TABLE_NAME) {
            const idx = tables.USER_SETTINGS.findIndex((u) => u.userId === params.Item.userId);
            if (idx >= 0) tables.USER_SETTINGS[idx] = params.Item;
            else tables.USER_SETTINGS.push(params.Item);
          }
          return {};
        },
      };
    }
    delete(params) {
      return {
        promise: async () => {
          if (params.TableName === process.env.TOPICS_TABLE_NAME) {
            const idx = tables.TOPICS.findIndex(
              (t) => t.userId === params.Key.userId && t.topicId === params.Key.topicId
            );
            if (idx >= 0) tables.TOPICS.splice(idx, 1);
          }
          if (params.TableName === process.env.NODES_TABLE_NAME) {
            const idx = tables.NODES.findIndex(
              (n) => n.topicId === params.Key.topicId && n.nodeId === params.Key.nodeId
            );
            if (idx >= 0) tables.NODES.splice(idx, 1);
          }
          return {};
        },
      };
    }
    batchWrite(params) {
      return {
        promise: async () => {
          const requests = params.RequestItems?.[process.env.NODES_TABLE_NAME] ?? [];
          requests.forEach((req) => {
            if (req.DeleteRequest) {
              const { topicId, nodeId } = req.DeleteRequest.Key;
              const idx = tables.NODES.findIndex((n) => n.topicId === topicId && n.nodeId === nodeId);
              if (idx >= 0) tables.NODES.splice(idx, 1);
            }
          });
          return {};
        },
      };
    }
    update(params) {
      return {
        promise: async () => {
          if (params.TableName === process.env.NODES_TABLE_NAME) {
            const idx = tables.NODES.findIndex(
              (n) => n.topicId === params.Key.topicId && n.nodeId === params.Key.nodeId
            );
            if (idx >= 0) {
              const item = tables.NODES[idx];
              const values = params.ExpressionAttributeValues || {};
              if (values[":title"] !== undefined) item.title = values[":title"];
              if (values[":summary"] !== undefined) item.summary = values[":summary"];
              if (values[":type"] !== undefined) item.type = values[":type"];
              if (values[":messages"] !== undefined) item.messages = values[":messages"];
              if (values[":updatedAt"] !== undefined) item.updatedAt = values[":updatedAt"];
              tables.NODES[idx] = item;
            }
          }
          return {};
        },
      };
    }
  }

  class MockKMS {
    encrypt(params) {
      return {
        promise: async () => ({
          CiphertextBlob: Buffer.from(params.Plaintext).toString("base64"),
        }),
      };
    }
    decrypt(params) {
      return {
        promise: async () => ({
          Plaintext: Buffer.from(params.CiphertextBlob.toString(), "base64"),
        }),
      };
    }
  }

  return {
    default: {
      DynamoDB: { DocumentClient: MockDocumentClient },
      KMS: MockKMS,
    },
  };
});

let handler;

const buildEvent = ({ method, path, body, query, userId = "user-1" }) => ({
  version: "2.0",
  rawPath: path,
  requestContext: {
    http: { method },
    authorizer: { jwt: { claims: { sub: userId } } },
  },
  queryStringParameters: query,
  body: body ? JSON.stringify(body) : undefined,
});

beforeAll(async () => {
  process.env.TOPICS_TABLE_NAME = "Topics";
  process.env.NODES_TABLE_NAME = "Nodes";
  process.env.USER_SETTINGS_TABLE_NAME = "UserSettings";
  process.env.NODES_GSI1_NAME = "NodesByParent";
  process.env.NODES_GSI2_NAME = ""; // disable GSI2 path in findNode for simplicity
  process.env.KMS_KEY_ARN = "kms-key";
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: "assistant" } }] }),
    text: async () => "",
  }));
  handler = (await import("../src/index.ts")).handler;
});

beforeEach(() => {
  tables.TOPICS.length = 0;
  tables.NODES.length = 0;
  tables.USER_SETTINGS.length = 0;
});

describe("route validations", () => {
  it("rejects later node creation when parent belongs to another topic", async () => {
    const topicA = { userId: "user-1", topicId: "topic#a", name: "A", createdAt: now(), updatedAt: now() };
    const topicB = { userId: "user-1", topicId: "topic#b", name: "B", createdAt: now(), updatedAt: now() };
    const foreignParent = {
      topicId: topicB.topicId,
      nodeId: "node#x",
      userId: "user-1",
      title: "foreign",
      summary: "foreign",
      createdAt: now(),
      updatedAt: now(),
    };
    tables.TOPICS.push(topicA, topicB);
    tables.NODES.push(foreignParent);

    const res = await handler(
      buildEvent({
        method: "POST",
        path: "/v1/nodes",
        body: { topicId: topicA.topicId, parentId: foreignParent.nodeId, summary: "later" },
      })
    );

    expect(res.statusCode).toBe(404);
    const payload = JSON.parse(res.body);
    expect(payload.error.code).toBe("PARENT_NOT_FOUND");
  });

  it("rejects later node creation under another later node", async () => {
    const topic = { userId: "user-1", topicId: "topic#a", name: "A", createdAt: now(), updatedAt: now() };
    const laterParent = {
      topicId: topic.topicId,
      nodeId: "node#parent",
      userId: "user-1",
      title: "later parent",
      summary: "later parent",
      type: "later",
      messages: [],
      createdAt: now(),
      updatedAt: now(),
    };
    tables.TOPICS.push(topic);
    tables.NODES.push(laterParent);

    const res = await handler(
      buildEvent({
        method: "POST",
        path: "/v1/nodes",
        body: { topicId: topic.topicId, parentId: laterParent.nodeId, summary: "child later" },
      })
    );

    expect(res.statusCode).toBe(400);
    const payload = JSON.parse(res.body);
    expect(payload.error.code).toBe("PARENT_NOT_ALLOWED");
  });

  it("rejects chat creation when baseNode belongs to another topic", async () => {
    const topicA = { userId: "user-1", topicId: "topic#a", name: "A", createdAt: now(), updatedAt: now() };
    const topicB = { userId: "user-1", topicId: "topic#b", name: "B", createdAt: now(), updatedAt: now() };
    const foreignBase = {
      topicId: topicB.topicId,
      nodeId: "node#base",
      userId: "user-1",
      title: "base",
      summary: "base",
      type: "chat",
      messages: [],
      createdAt: now(),
      updatedAt: now(),
    };
    tables.TOPICS.push(topicA, topicB);
    tables.NODES.push(foreignBase);
    tables.USER_SETTINGS.push({
      userId: "user-1",
      apiKeyEncrypted: Buffer.from("sk-test").toString("base64"),
      llmProvider: "openai",
      model: "gpt-4o-mini",
      updatedAt: now(),
    });

    const res = await handler(
      buildEvent({
        method: "POST",
        path: "/v1/chat",
        body: { topicId: topicA.topicId, baseNodeId: foreignBase.nodeId, message: "hello" },
      })
    );

    expect(res.statusCode).toBe(400);
    const payload = JSON.parse(res.body);
    expect(payload.error.code).toBe("BASE_NODE_TOPIC_MISMATCH");
  });

  it("creates chat node successfully within same topic", async () => {
    const topic = { userId: "user-1", topicId: "topic#a", name: "A", createdAt: now(), updatedAt: now() };
    tables.TOPICS.push(topic);
    tables.USER_SETTINGS.push({
      userId: "user-1",
      apiKeyEncrypted: Buffer.from("sk-test").toString("base64"),
      llmProvider: "openai",
      model: "gpt-4o-mini",
      updatedAt: now(),
    });

    const res = await handler(
      buildEvent({
        method: "POST",
        path: "/v1/chat",
        body: { topicId: topic.topicId, message: "question" },
      })
    );

    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload.node).toBeTruthy();
    expect(payload.node.topicId).toBe(topic.topicId);
    expect(payload.node.messages?.length).toBe(2);
  });

  it("deletes later node for owner", async () => {
    const topic = { userId: "user-1", topicId: "topic#a", name: "A", createdAt: now(), updatedAt: now() };
    const laterNode = {
      topicId: topic.topicId,
      nodeId: "node#later",
      userId: "user-1",
      title: "later",
      summary: "later",
      type: "later",
      messages: [],
      createdAt: now(),
      updatedAt: now(),
    };
    tables.TOPICS.push(topic);
    tables.NODES.push(laterNode);

    const res = await handler(buildEvent({ method: "DELETE", path: `/v1/nodes/${laterNode.nodeId}` }));
    expect(res.statusCode).toBe(204);
    expect(tables.NODES.find((n) => n.nodeId === laterNode.nodeId)).toBeUndefined();
  });

  it("rejects deleting non-later node", async () => {
    const topic = { userId: "user-1", topicId: "topic#a", name: "A", createdAt: now(), updatedAt: now() };
    const chatNode = {
      topicId: topic.topicId,
      nodeId: "node#chat",
      userId: "user-1",
      title: "chat",
      summary: "chat",
      type: "chat",
      messages: [],
      createdAt: now(),
      updatedAt: now(),
    };
    tables.TOPICS.push(topic);
    tables.NODES.push(chatNode);

    const res = await handler(buildEvent({ method: "DELETE", path: `/v1/nodes/${chatNode.nodeId}` }));
    expect(res.statusCode).toBe(400);
    const payload = JSON.parse(res.body);
    expect(payload.error.code).toBe("DELETE_NOT_ALLOWED");
  });
});
