# DynamoDB テーブル設計（v1）

QMap が満たすアクセスパターンに対して、v1 で採用する 3 テーブル構成（UserSettings / Topics / Nodes）をまとめる。将来 Single-table 化は移行で対応可能。

2025-01-XX 更新: `/chat` で `nodeId` を指定し type="later" を chat に昇格するパスを追加。既存レコードを更新し label/parentId は保持、messages を送信/応答 2 件で上書き。Nodes テーブルの `type`/`messages` に対し上書き更新が発生する。

## 0. アクセスパターン
- ユーザーの Topic 一覧を取得: userId → Topics
- Topic 内のノード一覧を取得（ツリー描画）: topicId → Nodes
- ノードの親を辿ってパスを取得: topicId + nodeId → parent を再帰取得
- ノードの子ノード一覧を取得: parentId → 子ノード
- ユーザーごとの LLM 設定取得: userId → UserSettings

## 1. テーブル構成
- UserSettings: ユーザー別 LLM 設定
- Topics: スレッド
- Nodes: トピック内ノード（ツリーの各ポイント）

## 2. UserSettings
- テーブル名: `UserSettings`
- PK: `userId`
- 例:
```json
{
  "userId": "user#123",
  "llmProvider": "openai",
  "model": "gpt-4.1",
  "apiKeyEncrypted": "<KMSで暗号化済み文字列>",
  "createdAt": "2025-12-07T12:00:00Z",
  "updatedAt": "2025-12-07T12:00:00Z"
}
```
- アクセス: GetItem/Put/Update by userId。GSI 不要。

## 3. Topics
- テーブル名: `Topics`
- PK: `userId`, SK: `topicId`
- 例:
```json
{
  "userId": "user#123",
  "topicId": "topic#web-sec",
  "name": "Webセキュリティ",
  "createdAt": "2025-12-07T12:00:00Z",
  "updatedAt": "2025-12-07T12:10:00Z"
}
```
- アクセス:
  - ユーザーの Topic 一覧: Query by userId。
  - Topic 詳細: GetItem(userId, topicId)。
- 任意 GSI（最近更新順を出す場合）:
  - GSI1: PK=userId, SK=updatedAt, ScanIndexForward=false で最新順。

## 4. Nodes（メイン）
- テーブル名: `Nodes`
- PK: `topicId`, SK: `nodeId`（ULID/UUID でグローバル一意）
- 例:
```json
{
  "topicId": "topic#web-sec",
  "nodeId":  "node#01HF...",
  "userId":  "user#123",          // 冗長だが認可チェック用に保持
  "parentId": null,               // ルートは null
  "label":   "A1",                // UI 表示用
  "title": "XSSって何？",
  "summary": "XSSとは何かを質問したノード",
  "type": "chat",                 // "chat" | "later"
  "messages": [
    { "role": "user", "content": "XSSって何？", "createdAt": "..." },
    { "role": "assistant", "content": "XSSとは...", "createdAt": "..." }
  ],
  "createdAt": "2025-12-07T12:01:00Z",
  "updatedAt": "2025-12-07T12:01:10Z"
}
```
- アクセス:
  - Topic 内ノード一覧: Query by topicId（ツリー描画用）。Topic あたり数百ノード想定。
  - 特定ノード詳細: GetItem(topicId, nodeId)。
  - パス取得: GetItem で parentId を再帰（深さ 10〜20 程度なら許容。BatchGet 併用可）。
  - 子ノード一覧: GSI で高速化（下記）。

### 4-1. GSI1（子ノード取得用）
- 名称: `GSI1_ByParent`
- PK: `parentId`（親の nodeId）
- SK: `createdAt`
- クエリ例:
```
Query Nodes.GSI1_ByParent
  where parentId = "node#A1"
  order by createdAt ASC
```
→ A1 の直下の子ノードを取得。

### 4-2. GSI2（任意: 最近触ったノード）
- 名称: `GSI2_ByUserUpdated`
- PK: `userId`
- SK: `updatedAt`
- クエリ例:
```
Query Nodes.GSI2_ByUserUpdated
  where userId = "user#123"
  order by updatedAt DESC
  limit 20
```
→ ユーザーが最近更新したノード上位 N 件。

## 5. messages の持ち方（v1）
- 各ノードの messages には「そのノードでの user 入力」と「対応する assistant 応答」のペアのみを格納（単ターン）。  
- LLM 送信時は `/nodes/{id}/path` のようにルートからパス上の messages を連結して履歴を構築。  
- メリット: ノード単位で Item サイズを抑えつつ、履歴を正しく再現できる。  
- v2 検討: ノード内で複数ターンを許容、古いノードを要約する summary ノードを導入してトークン節約など。

## 6. まとめ
- UserSettings: PK=userId。GSI なし。LLM 設定の保存/取得。
- Topics: PK=userId, SK=topicId。Query で一覧、GetItem で詳細。任意 GSI(updatedAt)。
- Nodes: PK=topicId, SK=nodeId。Query(topicId) で全件、GetItem で1件、親再帰でパス、GSI1(parentId/createdAt) で子一覧。任意 GSI2(userId/updatedAt) で最近ノード。
