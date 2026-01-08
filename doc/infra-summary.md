# QMap インフラ構成メモ

2025-01-XX 更新: `/chat` で `nodeId` を受け取って later→chat 昇格を処理する現行コードを前提。フロントは Ctrl/Cmd+Enter 送信を持つ。

- IaC: Terraform（単一ディレクトリ: `infra/terraform`、環境切替は backend-*.hcl + tfvars）
- 状態管理: S3 バケット `qmap-tfstate-710146154969-apne1` + DynamoDB ロックテーブル `qmap-terraform-locks`（backend-dev.hcl / backend-prod.hcl で key を dev/prod に分離）
- デプロイ対象: Vercel（フロント）、API Gateway (HTTP API)、Cognito、DynamoDB、KMS、Lambda
- Lambda 実装: `backend/src/index.ts`（TypeScript, Dynamo/KMS/LLM 連携。`./scripts/build-lambda.sh` で `backend/dist_bundle` を作り Lambda 依存込みで zip）

## 実施済み
- Terraform コードを `infra/terraform` に集約し、backend-*.hcl で環境別 key を指定
- dev/prod で `terraform init/apply` 済み（アクセス用 PAT は実行時に環境変数で注入、state は環境別 key で分離）
- Terraform lock ファイルを各環境で生成し、.gitignore で lambda.zip を無視
- 環境は dev/prod の 2 つに集約（stg は廃止）

## 環境別アウトプット
dev (`backend-dev.hcl`, backend key `qmap/dev/terraform.tfstate`)
- API: `https://csdq8anoqk.execute-api.ap-northeast-1.amazonaws.com/dev`
- Vercel: `https://q-map-nine.vercel.app`
- Cognito: Pool `ap-northeast-1_lqWaVR5zJ`, Client `hu7sci88c77tphc38thskdtvj`, Domain `qmap-dev.auth.ap-northeast-1.amazoncognito.com`

prod (`backend-prod.hcl`, backend key `qmap/prod/terraform.tfstate`)
- API: `https://4s9u0m4qqh.execute-api.ap-northeast-1.amazonaws.com/prod`
- Vercel: `https://q-map-prod.vercel.app`
- Cognito: Pool `ap-northeast-1_n1bgtdkW7`, Client `2kubshj1c0jnpkq2s0hbitovhn`, Domain `qmap-prod.auth.ap-northeast-1.amazoncognito.com`

## 運用フロー（Terraform）
1. コードは `infra/terraform` のみを使用（環境切替は backend-*.hcl と tfvars で指定）
2. 変更があれば tfvars を修正（例: callback/logout/allowed_origins を実ドメインに差し替え）
3. 実行例（dev）  
   ```bash
   ./scripts/build-lambda.sh  # backend を dist_bundle にビルド（aws-sdk など実行時依存込み）
   cd infra/terraform
   terraform init -reconfigure -backend-config=backend-dev.hcl
   terraform apply -var-file=dev.tfvars
   ```
   ※ prod は `backend-prod.hcl` と `prod.tfvars` に切り替えるだけ
4. 出力の確認: `terraform output`

## ドメイン
- 現状は Vercel のドメインを callback/logout/origins に設定済み  
  - dev: https://q-map-nine.vercel.app  
  - prod: https://q-map-prod.vercel.app
- 独自ドメインに切り替える場合は各 tfvars を変更して再度 `terraform apply`

## フロント連携メモ
- 必要な環境変数（例）: `VITE_API_BASE_URL`（基本 `/api`）、`VITE_API_PROXY_TARGET`（ローカル開発で APIGW にプロキシする場合）、`VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN`, `VITE_AWS_REGION`
- 値は上記アウトプットを使用。Vercel は `/api` リライト + 環境変数、ローカルは Vite の proxy で `/api` → APIGW に転送

## テスト
- Lambda ロジックの単体テスト: `npm test`（Vitest）

## 次にやること
- 実ドメイン確定後、tfvars の callback/logout/allowed_origins を更新して dev/prod で再 apply
- Vercel の rewrite `/api/*` が dev/prod で期待通りか確認
- CI で plan/apply とフロントビルドを dev/prod で回す（prod は手動承認推奨）

## 進捗まとめ
やったこと
- frontend/backend/infra に分離（frontend は Vite+React、backend は TypeScript Lambda）
- Terraform を単一ディレクトリに集約し、backend-*.hcl で dev/prod のステートを分離
- Lambda を TypeScript で実装し、`./scripts/build-lambda.sh` で dist_bundle を生成して依存込みでデプロイ
- dev/prod で Terraform apply 済み（Hosted UI callback/logout/allowed_origins を Vercel ドメインへ更新、Lambda 500 の原因だった aws-sdk を同梱）
- フロントは Cognito Hosted UI ベースのログイン画面に変更（未ログイン時はログイン専用表示、デバッグ用に手動トークン入力欄も残置）
- 環境別のフロント `.env.*.example` を整備し、Vercel に VITE_* を流し込む設計に更新
- リポジトリを GitHub (`git@github.com:mugishiro/q-map.git`) へ push 済み

まだ未完了/今後やること
- 本番/開発の実ドメインが未確定（確定後 tfvars を差し替えて apply）
- Hosted UI のブランド調整（Cognito 標準のカスタマイズ範囲内でロゴ/色設定を検討）
- CI で環境別 plan/apply + フロントビルドを回すワークフローが未実装（dev/prod）
