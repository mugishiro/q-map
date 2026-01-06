# QMap アーキテクチャ概要

フロントエンドの React SPA から LLM 呼び出しまでの構成を示す。ホスティングは Amplify Hosting（内部で CloudFront/CDN を利用）。`/api/*` は API Gateway 経由で Lambda (BFF) にルーティングする。Lambda は DynamoDB/KMS/LLM 各種 API を扱う。

2025-01-XX 更新メモ: `/v1/chat` は `nodeId` を受け取り、type="later" のノードを chat に昇格させるフローを含む（label/parentId は維持し messages を送信/応答の 2 件で上書き）。フロントは Ctrl/Cmd+Enter 送信をサポート。

```
[ブラウザ: React SPA]
   │  HTTPS (Amplify Hosting のドメイン)
   ▼
[Amplify Hosting (CDN)]
   │
   │  /api/* だけ API Gateway にルーティング（カスタムドメイン or Amplify でのリライトルール）
   ▼
[API Gateway HTTP API]
   ▼
[Lambda (BFF)]
   │   ├─ DynamoDB (Topics / Nodes / UserSettings) への読書き
   │   ├─ KMS で API キー復号
   │   └─ LLM プロバイダ (OpenAI / Claude / Gemini ほか) 呼び出し
   ▼
[LLM API 各種]
```

## コンポーネント役割
- **Amplify Hosting**: React SPA をビルド/デプロイし CDN 配信。`/api/*` はカスタムリライトルールで API Gateway にフォワード。
- **API Gateway (HTTP API)**: Lambda への入口。
- **Lambda (BFF)**:
  - 構成: v1 は単一 Lambda で API を集約（必要に応じて /chat 等の重い系を将来分割）。
  - 役割: 既定 userId で DynamoDB CRUD・パス再帰取得・子ノード取得、KMS で API キー復号、LLM プロバイダ呼び出し。
  - 実装: Node.js/TypeScript 推奨。構造化ログと共通エラーハンドリングを持つ薄い BFF。
- **環境変数/シークレット**: TABLE 名や KMS ARN などは環境変数。LLM API キーは DB に暗号化保存し、実行時に KMS/Secrets Manager から復号。Amplify 側には平文キーを保持しない。
- **DynamoDB**: `doc/DYNAMODB_DESIGN.md` に詳細。3 テーブル（UserSettings/Topics/Nodes）+ GSI。
- **LLM API**: ユーザー設定で指定されたプロバイダ・モデルにリクエスト。コストはユーザー負担。

## リクエストフロー例（/api/chat）
1. ブラウザ → Amplify Hosting（CDN）→ API Gateway（/api/chat）。
2. Lambda 呼び出し。
3. Lambda:
   - topicId/baseNodeId のバリデーション。
   - Nodes を辿りパス messages を構築。
   - UserSettings を取得し、KMS 復号で API キーを得る。
   - LLM プロバイダへリクエスト → 応答取得。
   - 新ノードを DynamoDB に保存しレスポンス。
4. ブラウザはレスポンスを受けツリーを更新。

## 運用ポイント
- **セキュリティ**: API キーは暗号化保存・復号は実行時のみ。CORS は SPA ドメインに限定。
- **コスト最適化**: Amplify Hosting(CloudFront/CDN 含む) + DynamoDB + Lambda + CloudWatch で月 200〜650 円目安（LLM コストはユーザー負担）。
- **拡張案**: `/chat/stream` の SSE、GraphQL 化、Single-table モデリングへの移行、要約ノードによるトークン節約。
