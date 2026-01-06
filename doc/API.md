# QMap REST API ドキュメント

ベース URL 例（ステージパス付き）:  
- dev: `https://csdq8anoqk.execute-api.ap-northeast-1.amazonaws.com/dev`  
- prod: `https://4s9u0m4qqh.execute-api.ap-northeast-1.amazonaws.com/prod`  
フォーマット: `application/json`  
認証: Cognito 等で発行された JWT を `Authorization: Bearer <JWT>` で送る。全リソースは JWT の `userId` に紐づく。

## 共通
- ヘッダ: `Content-Type: application/json`, `Authorization: Bearer <JWT>`
- タイムスタンプ: ISO 8601（UTC）
- ページネーション: `limit`（デフォルト 50）、`cursor`（文字列）。`nextCursor` が null で終端。
- エラー形式: 共通エラーを参照。

## 型定義
```ts
export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  createdAt: string; // ISO 8601
};

export type Topic = {
  topicId: string;        // 実体は "topic#<uuid>"。一部レスポンスでは `id` エイリアスを併記
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Node = {
  nodeId: string;         // 実体は "node#<uuid>"。一部レスポンスでは `id` エイリアスを併記
  label?: string;         // UI 表示用ラベル（例: A1/B2）
  topicId: string;
  parentId?: string;      // ルートは null/undefined
  title?: string;         // UI の短い表示名
  summary?: string;       // 質問や要約
  type?: "chat" | "later";
  createdAt: string;
  updatedAt: string;
};

export type NodeWithMessages = Node & {
  messages: ChatMessage[];
};

export type UserSettings = {
  llmProvider: "openai" | "anthropic" | "gemini" | "openrouter" | null;
  model: string | null;
  apiKeyMasked: string | null; // 平文キーは返さない
};
```

## 認証・ユーザー設定
### GET /me/settings
- 用途: LLM 設定の確認（API キー値は返さない）。
- レスポンス 200:
```json
{ "llmProvider": "openai", "model": "gpt-4.1", "apiKeyMasked": "sk-************abcd" }
```
- 未設定時:
```json
{ "llmProvider": null, "model": null, "apiKeyMasked": null }
```
備考:
- 現状サーバ側で許可するプロバイダは `openai` / `openrouter` / `anthropic` / `gemini` のみ。
- API キーは保存時に KMS で暗号化し、レスポンスでは復号してマスクした文字列を返す。

### POST /me/settings
- 用途: LLM 設定を保存。`apiKey` は平文で受け、サーバ側で KMS 暗号化。
- 前提: ユーザーごとに 1 つのアクティブ設定のみ保持（複数プロファイルは未対応）。新しい設定で上書き保存。
- リクエスト:
```json
{ "llmProvider": "openai", "model": "gpt-4.1-mini", "apiKey": "sk-xxxx..." }
```
- レスポンス 200:
```json
{ "llmProvider": "openai", "model": "gpt-4.1-mini", "apiKeyMasked": "sk-************abcd" }
```
- 注意: `apiKey` はレスポンスに含めない。

## Topic API
### GET /topics
- クエリ: `limit`（デフォルト 50）、`cursor`
- レスポンス 200:
```json
{
  "items": [
    { "topicId": "topic#web-sec", "name": "Webセキュリティ", "createdAt": "2025-12-07T12:00:00Z", "updatedAt": "2025-12-07T12:10:00Z" }
  ],
  "nextCursor": null
}
```

### POST /topics
- リクエスト:
```json
{ "name": "Webセキュリティ" }
```
- レスポンス 201: `Topic`（`id` と `topicId` の両方を返す）

### GET /topics/{topicId}
- 用途: メタ情報取得。レスポンスは `Topic`。

### DELETE /topics/{topicId}
- 用途: Topic と配下ノードの削除。
- レスポンス: 204 No Content（または 200 で削除結果）。

## Node / Tree API
### GET /topics/{topicId}/nodes
- クエリ: `includeMessages` (true/false, デフォルト false)
- `includeMessages=false` → `Node` の配列（軽量、ツリー描画向け）。
- `includeMessages=true` → `NodeWithMessages` の配列。
- レスポンス例 (`includeMessages=false`):
```json
{
  "items": [
    {
      "nodeId": "01HF...A1",
      "label": "A1",
      "topicId": "t-web-sec",
      "parentId": null,
      "title": "XSSって何？",
      "summary": "XSSって何？",
      "type": "chat",
      "createdAt": "2025-12-07T12:01:00Z",
      "updatedAt": "2025-12-07T12:01:10Z"
    },
    {
      "nodeId": "01HF...B1",
      "label": "B1",
      "topicId": "t-web-sec",
      "parentId": "01HF...A1",
      "title": "具体例を教えて",
      "summary": "XSSの具体例について質問",
      "type": "chat",
      "createdAt": "2025-12-07T12:05:00Z",
      "updatedAt": "2025-12-07T12:05:08Z"
    },
    {
      "nodeId": "01HF...B2",
      "label": "B2",
      "topicId": "t-web-sec",
      "parentId": "01HF...A1",
      "title": "あとで: SQL Injection について",
      "summary": "SQL Injection について",
      "type": "later",
      "createdAt": "2025-12-07T12:15:00Z",
      "updatedAt": "2025-12-07T12:15:00Z"
    }
  ]
}
```

### GET /nodes/{nodeId}
- 用途: 単一ノードの詳細（messages 付き）。
- レスポンス 200 例:
```json
{
  "nodeId": "01HF...B1",
  "label": "B1",
  "topicId": "t-web-sec",
  "parentId": "01HF...A1",
  "title": "具体例を教えて",
  "summary": "XSSの具体例について質問",
  "type": "chat",
  "createdAt": "2025-12-07T12:05:00Z",
  "updatedAt": "2025-12-07T12:05:08Z",
  "messages": [
    { "role": "user", "content": "具体例を教えて", "createdAt": "2025-12-07T12:05:01Z" },
    { "role": "assistant", "content": "例えば、掲示板に...", "createdAt": "2025-12-07T12:05:08Z" }
  ]
}
```

### GET /nodes/{nodeId}/path
- 用途: 右ペイン表示・LLM 送信用の「過去から選択ノードまでの正しい歴史」取得。
- レスポンス 200:
```json
{
  "topicId": "t-web-sec",
  "path": [
    {
      "nodeId": "01HF...A1",          // ULID
      "label": "A1",
      "title": "XSSって何？",
      "summary": "XSSって何？",
      "type": "chat",
      "messages": [
        { "role": "user", "content": "XSSって何？", "createdAt": "..." },
        { "role": "assistant", "content": "XSSとは...", "createdAt": "..." }
      ]
    },
    {
      "nodeId": "01HF...B1",
      "label": "B1",
      "title": "具体例を教えて",
      "summary": "XSSの具体例について質問",
      "type": "chat",
      "messages": [
        { "role": "user", "content": "具体例を教えて", "createdAt": "..." },
        { "role": "assistant", "content": "例えば、掲示板に...", "createdAt": "..." }
      ]
    }
  ]
}
```

### POST /nodes
- 用途: LLM を呼ばない “later” ノードの作成。
- リクエスト:
```json
{ "topicId": "t-web-sec", "parentId": "01HF...A1", "summary": "SQL Injection について", "type": "later" } // label=A1
```
- レスポンス 201: `Node`（type="later"、messages は返さない）。

### PATCH /nodes/{nodeId}
- 用途: メタ情報の更新（タイトル・summary のみ）。`messages` は更新不可。
- リクエスト例:
```json
{ "title": "XSSの対策", "summary": "XSSの対策を整理したノード" }
```
- レスポンス 200: 更新後の `Node`

## チャット API（ノード生成 + LLM 呼び出し）
### POST /chat
- 用途:
  - type="chat" の新ノードを作成、または既存の「あとで聞く」ノードを chat に昇格。
  - `baseNodeId` までのパスを辿り、パス内 messages + 今回の user 入力だけで LLM を呼ぶ。
  - 応答を含むノードを返す。
- リクエスト例（ルート作成）:
```json
{ "topicId": "t-web-sec", "baseNodeId": null, "message": "XSSって何？" }
```
- リクエスト例（既存ノードを基点）:
```json
{ "topicId": "t-web-sec", "baseNodeId": "01HF...A1", "message": "具体例を教えて" } // label=A1
```
- リクエスト例（あとで聞くノードを chat に昇格）:
```json
{ "topicId": "t-web-sec", "baseNodeId": "01HF...A1", "nodeId": "01HF...B2", "message": "SQL Injection について" }
```
- フィールド:
  - `topicId` (必須)
  - `baseNodeId` (null または ノード ID) — null はルート作成
  - `nodeId` (任意) — type="later" の既存ノードを chat に昇格する場合に指定
  - `message` (必須) — ユーザー入力
- レスポンス 200:
```json
{
  "node": {
    "nodeId": "01HF...B1",
    "label": "B1",
    "topicId": "t-web-sec",
    "parentId": "01HF...A1",
    "title": "具体例を教えて",
    "summary": "XSSの具体例について質問",
    "type": "chat",
    "createdAt": "2025-12-07T12:05:00Z",
    "updatedAt": "2025-12-07T12:05:08Z",
    "messages": [
      { "role": "user", "content": "具体例を教えて", "createdAt": "2025-12-07T12:05:01Z" },
      { "role": "assistant", "content": "例えば、掲示板に...", "createdAt": "2025-12-07T12:05:08Z" }
    ]
  }
}
```
- サーバ内の処理ステップ（概要）:
  1) `topicId` 所有確認。  
  2) `baseNodeId` があれば親を遡ってパス取得。  
  3) パス内 messages を時系列連結し、末尾に今回の user メッセージを追加 → これだけを LLM に送る（兄弟・未来分岐は含めない）。  
  4) UserSettings で LLM クライアントを構築し呼び出し。  
  5) `nodeId` が指定され type="later" の場合はそのノードを再利用し、title/summary を message で置換・messages を今回の user/assistant 2 件で上書きし、type="chat" に更新する。指定なしの場合は新ノード（type="chat"）を作成。  
  6) 変更後のノードをレスポンスする（label/parentId は再利用の場合も維持）。
- LLM 実行には `/me/settings` に保存された API キーが必須。プロバイダ未設定やキーなしの場合は `LLM_API_KEY_MISSING` を返す。
- ラベルは深さと兄弟数から `A1/B2/...` を自動採番する。

## まとめビュー API
### POST /topics/{topicId}/summary
- 用途: Topic 内のノードを集計し、サーバ側で簡易整形した文字列を返す（現状は LLM 呼び出しなし）。
- レスポンス 200:
```json
{
  "topicId": "t-web-sec",
  "summary": "- A1: XSSって何？\n- B1: 具体例を教えて\n- B2: あとで: SQL Injection について"
}
```
- 将来拡張案: LLM での要約生成や非同期ジョブ版 (`/topics/{topicId}/summary-jobs` → `/topics/{topicId}/summary-jobs/{jobId}`)。

## エラーレスポンス共通形式
```json
{
  "error": {
    "code": "LLM_API_KEY_MISSING",
    "message": "LLM API key is not configured in your settings."
  }
}
```
- 代表コード: `UNAUTHENTICATED`, `FORBIDDEN`, `TOPIC_NOT_FOUND`, `NODE_NOT_FOUND`, `LLM_API_KEY_MISSING`, `LLM_REQUEST_FAILED`, `VALIDATION_ERROR`.

## 実装上の注意
- `baseNodeId` のパス以外（兄弟・未来分岐）の messages を LLM に混ぜないことが最重要。
- messages は改ざん不可; 編集 API はタイトル/summary のみに限定。
- API キーは保存時に暗号化し、レスポンスでは必ずマスク表示。
- `includeMessages=true` はデータ量増になるため、Tree 描画は `false` を推奨。
