# QMap ユーザーフロー（時系列トレース）

「Webセキュリティ」トピックで、A1/B1/C1/B2 のツリーが育つまでを、呼ばれるエンドポイント・LLM に送る履歴・DB 保存・UI の見え方を時間順に記述する。登場する ID は例示。

## 0. 目標のツリー
```
Topic: Webセキュリティ
A1: XSSって何？
├─ B1: 具体例を教えて
│   ├─ C1: 対策は？
│   └─ C2: CSRFとの違いは？   (今回は未実施)
└─ B2: あとで聞く: SQL Injection について
```
B2 は「あとで聞く」ノードで LLM 呼び出しなし。
（内部 ID は ULID を nodeId に保持し、UI 表示用ラベルとして A1/B1/C1/B2 を `label` フィールドに持つ）

## データテーブル（例）
- TopicsTable: `{ userId, topicId, name, createdAt }`
- NodesTable: `{ topicId, nodeId(ULID), label, parentId, title, summary, messages, createdAt }`
- UserSettingsTable: `{ userId, llmProvider, model, apiKeyEncrypted }`
- ChatMessage: `{ role: "user" | "assistant", content: string }`

## 1. Topic 作成 + 最初の質問で A1 を作る
**ユーザー操作**  
- ログイン → 左ペインで「新規スレッド作成」入力「Webセキュリティ」→ 右ペインで「XSSって何？」送信。

**フロント→バックエンド**  
1) `POST /topics`
```json
{ "name": "Webセキュリティ" }
```
2) `POST /chat`
```json
{ "topicId": "t-web-sec", "baseNodeId": null, "message": "XSSって何？", "mode": "chat" }
```

**バックエンド処理**  
- TopicsTable に挿入: `{ userId:"u123", topicId:"t-web-sec", name:"Webセキュリティ", createdAt:"2025-12-07T12:00:00Z" }`
- baseNodeId=null → ルート作成モード。
- NodesTable に仮ノード A1 を作成（user メッセージを保持）。
```json
{
  "topicId": "t-web-sec",
  "nodeId": "01HF...A1",
  "parentId": null,
  "label": "A1",
  "title": "XSSって何？",
  "summary": "XSSって何？",
  "messages": [
    { "role": "user", "content": "XSSって何？" }
  ],
  "createdAt": "2025-12-07T12:01:00Z"
}
```
- UserSettingsTable から LLM 設定を取得。
- LLM 送信履歴（A1 までのパス = A1 の messages のみ）:
```json
{
  "model": "gpt-4.1",
  "messages": [
    { "role": "user", "content": "XSSって何？" }
  ]
}
```
- LLM 応答を受信し、A1.messages に追記して保存。

**UI**  
- 中央: ルート A1 が 1 つ表示。  
- 右: A1 の user/assistant ログを順に表示。

## 2. A1 を基点に B1 を作る（具体例の質問）
**ユーザー操作**  
- ツリーで A1 を選択したまま「具体例を教えて」を送信。

**フロント→バックエンド**  
`POST /chat`
```json
{ "topicId": "t-web-sec", "baseNodeId": "01HF...A1", "message": "具体例を教えて", "mode": "chat" } // label=A1
```

**バックエンド処理**  
- NodesTable から A1 を取得。親を辿ってパス = [A1] を構築。
- パス内 messages を時系列で連結し、今回の user メッセージを末尾に追加:
```json
[
  { "role": "user", "content": "XSSって何？" },
  { "role": "assistant", "content": "XSSとは、クロスサイトスクリプティングのことで..." },
  { "role": "user", "content": "具体例を教えて" }
]
```
- これを LLM に送信。応答を受信。
- 子ノード B1 を作成・保存（このノードでのやりとりを messages に保持する設計）。
```json
{
  "topicId": "t-web-sec",
  "nodeId": "01HF...B1",
  "parentId": "01HF...A1",
  "label": "B1",
  "title": "具体例を教えて",
  "summary": "XSSの具体例について質問",
  "messages": [
    { "role": "user", "content": "具体例を教えて" },
    { "role": "assistant", "content": "例えば、掲示板に <script>alert('XSS')</script> ..." }
  ],
  "createdAt": "2025-12-07T12:05:00Z"
}
```

**UI**  
- 中央: A1 の下に B1 が追加。  
- 右: パス A1→B1 を表示し、A1 と B1 の messages を時系列で表示。

## 3. A1 に戻って別未来 C1 を作る（対策を質問）
**ユーザー操作**  
- A1 を再選択し「対策は？」を送信。

**フロント→バックエンド**  
`POST /chat`
```json
{ "topicId": "t-web-sec", "baseNodeId": "01HF...A1", "message": "対策は？", "mode": "chat" } // label=A1
```

**バックエンド処理**  
- パス = [A1]（B1 は含まない）。  
- LLM 送信履歴:
```json
[
  { "role": "user", "content": "XSSって何？" },
  { "role": "assistant", "content": "XSSとは、クロスサイトスクリプティングのことで..." },
  { "role": "user", "content": "対策は？" }
]
```
- 応答を受信し、A1 の子として C1 を作成。
```json
{
  "topicId": "t-web-sec",
  "nodeId": "01HF...C1",
  "parentId": "01HF...A1",
  "label": "C1",
  "title": "対策は？",
  "summary": "XSSの対策について質問",
  "messages": [
    { "role": "user", "content": "対策は？" },
    { "role": "assistant", "content": "主な対策としては、エスケープ、入力バリデーション、CSP などがあります..." }
  ],
  "createdAt": "2025-12-07T12:10:00Z"
}
```

**UI**  
- 中央: A1 配下に B1 と並列で C1 が追加。  
- 右: ノード選択に応じてパスが切替（A1→B1 / A1→C1）。各パスの messages のみ表示。

## 4. 「あとで聞く」ノード B2 を追加（LLM 呼び出しなし）
**ユーザー操作**  
- A1 選択中に「SQL Injection について」を「あとで聞く」で送信。

**フロント→バックエンド**  
`POST /nodes`
```json
{ "topicId": "t-web-sec", "parentId": "01HF...A1", "summary": "SQL Injection について", "type": "later" } // label=A1
```

**バックエンド処理**  
- LLM 呼び出しなし。NodesTable に B2 を追加（messages は空）。
```json
{
  "topicId": "t-web-sec",
  "nodeId": "01HF...B2",
  "parentId": "01HF...A1",
  "label": "B2",
  "title": "あとで: SQL Injection について",
  "summary": "SQL Injection について",
  "messages": [],
  "createdAt": "2025-12-07T12:15:00Z"
}
```

**UI**  
- 中央: A1 配下に B2 が表示（タグ風・薄色）。  
- 右: B2 を選択するとタイトルが下書きにプリフィルされ、そのまま送信すると B2 自身が chat に昇格（label/parentId は維持、messages は送信/応答の2件に置換）。新しいノードは作らない。

## 5. 実装のキーロジックまとめ
- **基点ノード (baseNodeId)** を必ず指定し、親を辿ってパスを構築する。
- **LLM 送信履歴** = 現在のパスに含まれる各ノードの messages を時系列連結 + 今回の user 入力。兄弟や未来分岐の messages は決して混ぜない。
- **新しい発言** → 通常は新ノードを作成し `parentId = baseNodeId`。ただし選択中が「あとで聞く」ノードの場合はそのノードを chat に昇格し、label/parentId を保持したまま messages を送信/応答の 2 件で上書きする。
- **summary/title** はユーザー入力または要約を設定。ノード一覧やホバーに使う。
- **あとで聞くノード** は LLM を呼ばずに追加（messages 空）。選択するとタイトルを下書きに差し込み、送信でそのノードを昇格させる。
- **送信操作** はボタンに加えて Ctrl+Enter（Cmd+Enter）ショートカットでも実行できる。
- **パス表示とログ表示** は「選択ノードまでの正しい歴史」のみを UI と LLM の両方で共有する。
