"use strict";

// 簡易 BFF スタブ: パスとメソッドを元に 200 を返す
// 将来的に doc/API.md のルートごとに実処理を実装する前提
exports.handler = async (event) => {
  const method = event?.requestContext?.http?.method ?? "UNKNOWN";
  const path = event?.rawPath ?? "/";
  const requestId = event?.requestContext?.requestId ?? "";

  // TODO: ここに認証検証・ルーティング・Dynamo/KMS/LLM 呼び出しを実装する
  const body = {
    message: "stubbed",
    method,
    path,
    requestId,
  };

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
};
