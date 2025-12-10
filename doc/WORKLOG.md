# 作業サマリと残タスク

## 完了済み
- インフラ: dev/prod を Terraform で分離、S3+DynamoDB ステート。Amplify/API Gateway/Cognito/Dynamo/KMS/Lambda を各環境に構築。
- Lambda: TypeScript でリライト（Dynamo/KMS/LLM 連携、OpenAI/OpenRouter/Anthropic/Gemini）。`backend/` に集約し、`./scripts/build-lambda.sh` で dist を生成。
- ディレクトリ構成: `frontend`（Vite+React UI）、`backend`（Lambda）、`infra`（Terraform）に分割。Amplify は `appRoot: frontend`。
- フロント: トピック一覧/ツリー/パス表示/チャット・あとでノード追加のUIを実装。Cognito Hosted UI（PKCE）と手動 JWT 入力の両方をサポート。
- フロント: LLM 設定 UI（プロバイダ/モデル/API Key）を追加し、`/v1/me/settings` で保存・マスク表示できるようにした。
- 環境別サンプル env: （ローカル用サンプルは削除済み。必要なら Terraform 出力をもとに自作）
- リポジトリ: GitHub `git@github.com:mugishiro/q-map.git` に push 済み。

## 未完了・これからやること
- ドメイン確定後、`infra/terraform/<env>.tfvars` の callback/logout/allowed_origins を更新し、各環境で apply（dev/prod）。
- フロントの認証: Hosted UI の接続先ドメインを確定させ、リダイレクト/エラーハンドリングを含む動作確認を行う。
- Amplify 環境変数: 各環境ごとに VITE_ 系を設定（API_BASE_URL/UserPool/Client/Domain 等）。フロント `.env` と揃える。
- CI/CD: 環境別 plan/apply（prod は手動承認）とフロントビルドを GitHub Actions などで整備。backend ビルド（`./scripts/build-lambda.sh`）を apply 前に実行。
- E2E/統合テスト: フロント→API→Dynamo までの動作確認シナリオを追加（Cognito 認証込み）。
- LLM設定UI: 保存済み設定の再編集や入力バリデーション/エラー表示を整備し、キー未設定時のガイドを追加。
- エラーハンドリング/UX: API エラーの表示改善、ロード中の skeleton/インジケータ、ツリーのラベル生成・並びのチューニング。
