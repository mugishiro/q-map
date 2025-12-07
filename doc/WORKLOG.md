# 作業サマリと残タスク

## 完了済み
- インフラ: dev/stg/prod を Terraform で分離、S3+DynamoDB ステート。Amplify/API Gateway/Cognito/Dynamo/KMS/Lambda を各環境に構築。
- Lambda: TypeScript でリライト（Dynamo/KMS/LLM 連携、OpenAI/OpenRouter/Anthropic/Gemini）。`backend/` に集約し、`npm run build:lambda` で dist を生成。
- ディレクトリ構成: `frontend`（Vite+React UI）、`backend`（Lambda）、`infra`（Terraform）に分割。Amplify は `appRoot: frontend`。
- フロント: トピック一覧/ツリー/パス表示/チャット・あとでノード追加のUIを実装。JWT を手入力して API 呼び出し可能。
- 環境別サンプル env: `.env.dev/.stg/.prod.example` に API/Cognito のサンプルを記載。
- リポジトリ: GitHub `git@github.com:mugishiro/q-map.git` に push 済み。

## 未完了・これからやること
- ドメイン確定後、`infra/terraform-*/<env>.tfvars` の callback/logout/allowed_origins を更新し、各環境で apply。
- フロントの認証: 現状は JWT 貼り付け式。Cognito Hosted UI → コールバックで JWT 取得し、ストレージ管理するフローを実装する。
- Amplify 環境変数: 各環境ごとに VITE_ 系を設定（API_BASE_URL/UserPool/Client/Domain 等）。フロント `.env` と揃える。
- CI/CD: 環境別 plan/apply（prod は手動承認）とフロントビルドを GitHub Actions などで整備。backend ビルド（`npm run build:lambda`）を apply 前に実行。
- E2E/統合テスト: フロント→API→Dynamo までの動作確認シナリオを追加（Cognito 認証込み）。
- LLM設定UI: `/me/settings` を呼ぶ画面（プロバイダ/モデル/APIキー入力・保存・マスク表示）をフロントに追加。
- エラーハンドリング/UX: API エラーの表示改善、ロード中の skeleton/インジケータ、ツリーのラベル生成・並びのチューニング。
