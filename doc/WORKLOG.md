# 作業サマリと残タスク

## 完了済み
- インフラ: dev/prod を Terraform で分離、S3+DynamoDB ステート。Amplify/API Gateway/Cognito/Dynamo/KMS/Lambda を各環境に構築。
- Lambda: TypeScript でリライト（Dynamo/KMS/LLM 連携、OpenAI/OpenRouter/Anthropic/Gemini）。`backend/` に集約し、`./scripts/build-lambda.sh` で dist を生成。
- ディレクトリ構成: `frontend`（Vite+React UI）、`backend`（Lambda）、`infra`（Terraform）に分割。Amplify は `appRoot: frontend`。
- フロント: トピック一覧/ツリー/パス表示/チャット・あとでノード追加のUIを実装。Cognito Hosted UI（PKCE）と手動 JWT 入力の両方をサポート。
- フロント: LLM 設定 UI（プロバイダ/モデル/API Key）を追加し、`/v1/me/settings` で保存・マスク表示できるようにした。
- 環境別サンプル env: （ローカル用サンプルは削除済み。必要なら Terraform 出力をもとに自作）
- リポジトリ: GitHub `git@github.com:mugishiro/q-map.git` に push 済み。

## 現状レビュー (2025-12-10)
- バックエンド: 単一 Lambda で topics/nodes/chat/settings を実装。LLM は OpenAI/OpenRouter/Anthropic/Gemini 対応で、API キーは KMS 暗号化保存。バリデーション/レート制限/タイムアウトは未実装で、`/topics/{id}/summary` は LLM なしの簡易文字列生成。テストは Vitest で helper のみ。
- フロント: Vite+React。ログイン画面（Hosted UI/手動 JWT）、トピック一覧とツリー、チャット送信・あとで追加、LLM 設定 UI を搭載。ロード中の可視化やエラー整理、入力バリデーションは薄く、PathView/TokenBar など未使用コンポーネントが残存。LLM provider に `local` を出しているがバックエンドは非対応。
- インフラ: Terraform で dev/prod 環境を modules(base/data/auth/api/amplify) に分割。リモートステート S3+DynamoDB、Amplify は GitHub 連携(PAT)が必要。apply 前に `./scripts/build-lambda.sh` で dist_bundle を作る運用。CI/CD ワークフローは未整備。
- 仕様ギャップ: SPEC/USER_FLOW の想定する「Topic 作成時にルートノード自動生成」「LLM でのまとめ生成」などは未実装。API の実レスポンスは topicId/nodeId を返し、`id` は一部エイリアス。

## 未完了・これからやること
- ドメイン確定後、`infra/terraform/<env>.tfvars` の callback/logout/allowed_origins を更新し、各環境で apply（dev/prod）。
- フロントの認証: Hosted UI の接続先ドメインを確定させ、リダイレクト/エラーハンドリングを含む動作確認を行う。
- Amplify 環境変数: 各環境ごとに VITE_ 系を設定（API_BASE_URL/UserPool/Client/Domain 等）。フロント `.env` と揃える。
- CI/CD: 環境別 plan/apply（prod は手動承認）とフロントビルドを GitHub Actions などで整備。backend ビルド（`./scripts/build-lambda.sh`）を apply 前に実行。
- E2E/統合テスト: フロント→API→Dynamo までの動作確認シナリオを追加（Cognito 認証込み）。
- LLM設定UI: 保存済み設定の再編集や入力バリデーション/エラー表示を整備し、キー未設定時のガイドを追加。
- エラーハンドリング/UX: API エラーの表示改善、ロード中の skeleton/インジケータ、ツリーのラベル生成・並びのチューニング。
