# 実装の進め方（v1）

2025-01-XX 更新: `/chat` で `nodeId` 指定による「あとで聞く」ノード昇格を組み込み（label/parentId を維持し messages を 2 件で上書き）。フロントは Ctrl/Cmd+Enter 送信対応。

## 1. インフラ/IaC
- CDK などで API Gateway HTTP API + 単一 Lambda(BFF) + DynamoDB(UserSettings/Topics/Nodes+GSI1) + KMS を定義。
- 環境変数: TABLE 名、GSI 名、KMS ARN、LLM エンドポイント/モデル上限。
- 秘匿情報は DB に暗号化保存、実行時に KMS/Secrets Manager 経由で復号（Amplify には平文を置かない）。

## 2. 認証統合
- Cognito Hosted UI (email+パスワード, PKCE)。ソーシャルログインは未対応。
- API Gateway に JWT 検証を設定。フロントは `Authorization: Bearer <AccessToken>` を付与。

## 3. バックエンド（Lambda BFF）
- 共通ミドル: 認可(userId), 構造化ログ, 共通エラー, Dynamo クライアント, KMS 復号, LLM クライアントファクトリ。
- ハンドラ（ハッピーケース優先）:
  - `/topics` GET/POST/GET(id)/DELETE
  - `/topics/{id}/nodes` GET (includeMessages)
  - `/nodes/{id}`, `/nodes/{id}/path`
  - `/nodes` POST (later), `/nodes/{id}` PATCH (title/summaryのみ)
  - `/chat` POST（パス連結→LLM→新ノード保存）
- messages は 1ターン固定、label/ULID は不変。

## 4. フロント（Amplify Hosting）
- 3カラム骨組み: TopicList → TreeView → Path+Chat。
- API クライアントで `doc/API.md` 準拠の I/F を呼ぶ。初期はモックレスポンスで UI を先行実装し、順次実 API に置換。
- ユーザー設定画面で LLM 設定入力（provider/model/key）。

## 5. 計測・レート
- LLM 呼び出し前後で推定トークン数/レイテンシをログ出力（tokenEstimateIn/Out）。
- API Gateway レート制御（例: 10 RPS バースト20）。message 長は 4096 chars 目安。

## 6. CI/CD・デプロイ
- main push で Amplify 自動ビルド/デプロイ。PR/ブランチはプレビュー URL。
- IaC は dev/prod の 2 環境で分離し、テーブル名・ドメインを環境別に管理。

## 7. 後続検討（実装後）
- パス長が肥大化した場合の summary ノード導入。
- /chat のストリーミング SSE、ソーシャルログイン追加、Single-table モデリング移行。
