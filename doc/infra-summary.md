# QMap インフラ構成メモ

- IaC: Terraform（単一ディレクトリ: `infra/terraform`、環境切替は backend-*.hcl + tfvars）
- 状態管理: S3 バケット `qmap-tfstate-710146154969-apne1` + DynamoDB ロックテーブル `qmap-terraform-locks`（backend-dev.hcl / backend-prod.hcl で key を dev/prod に分離）
- デプロイ対象: Amplify（GitHub `https://github.com/mugishiro/q-map.git`）、API Gateway (HTTP API)、Cognito、DynamoDB、KMS、Lambda
- Lambda 実装: `backend/src/index.ts`（TypeScript, Dynamo/KMS/LLM 連携。`./scripts/build-lambda.sh` で `backend/dist_bundle` を作り Lambda 依存込みで zip）

## 実施済み
- Terraform コードを `infra/terraform` に集約し、backend-*.hcl で環境別 key を指定
- dev/prod で `terraform init/apply` 済み（アクセス用 PAT は実行時に環境変数で注入、state は環境別 key で分離）
- Terraform lock ファイルを各環境で生成し、.gitignore で lambda.zip を無視
- 環境は dev/prod の 2 つに集約（stg は廃止）

## 環境別アウトプット
dev (`backend-dev.hcl`, backend key `qmap/dev/terraform.tfstate`)
- API: `https://14z0sascyi.execute-api.ap-northeast-1.amazonaws.com/dev`
- Amplify: `dxhqhxj18etwj.amplifyapp.com`（main デフォルトドメイン）
- Cognito: Pool `ap-northeast-1_uP4pDNBGE`, Client `5aj6jthq1nqu343j82qi2i99ug`, Domain `qmap-dev.auth.ap-northeast-1.amazoncognito.com`

prod (`backend-prod.hcl`, backend key `qmap/prod/terraform.tfstate`)
- API: `https://4s9u0m4qqh.execute-api.ap-northeast-1.amazonaws.com/prod`
- Amplify: `d3c16q2d8f1ppt.amplifyapp.com`（main デフォルトドメイン）
- Cognito: Pool `ap-northeast-1_n1bgtdkW7`, Client `2kubshj1c0jnpkq2s0hbitovhn`, Domain `qmap-prod.auth.ap-northeast-1.amazoncognito.com`

## 運用フロー（Terraform）
1. コードは `infra/terraform` のみを使用（環境切替は backend-*.hcl と tfvars で指定）
2. 変更があれば tfvars を修正（例: callback/logout/allowed_origins を実ドメインに差し替え）
3. 実行例（dev）  
   ```bash
   ./scripts/build-lambda.sh  # backend を dist_bundle にビルド（aws-sdk など実行時依存込み）
   cd infra/terraform
   TF_VAR_amplify_access_token="<GitHub_PAT>" terraform init -reconfigure -backend-config=backend-dev.hcl
   TF_VAR_amplify_access_token="<GitHub_PAT>" terraform apply -var-file=dev.tfvars
   ```
   ※ prod は `backend-prod.hcl` と `prod.tfvars` に切り替えるだけ
4. 出力の確認: `terraform output`

### Amplify 用 PAT の渡し方を省力化する
- direnv を利用する場合（おすすめ・ローカル専用）  
  `infra/terraform/.envrc` を作成し、`export TF_VAR_amplify_access_token=<PAT>` を記載して gitignore。`direnv allow` 後はディレクトリに入るだけで PAT が反映される。
- `.auto.tfvars` を使う場合  
  `infra/terraform/secret.auto.tfvars` に `amplify_access_token = "<PAT>"` を書き、`chmod 600`。`.auto.tfvars` は自動読込されるため apply 時のフラグが不要。必ず gitignore されたファイル名にする。
- チーム共有や CI で使う場合  
  AWS SSM パラメータストア / Secrets Manager に PAT を格納し、Terraform で `data "aws_ssm_parameter"` 経由で参照する実装に移行する。state/S3 に値が残る点は考慮すること。

## ドメイン
- 現状は Amplify デフォルトドメインを callback/logout/origins に設定済み  
  - dev: https://main.dxhqhxj18etwj.amplifyapp.com  
  - prod: https://main.d3c16q2d8f1ppt.amplifyapp.com
- 独自ドメインに切り替える場合は各 tfvars を変更して再度 `terraform apply`

## フロント連携メモ
- 必要な環境変数（例）: `VITE_API_BASE_URL`（基本 `/api`）、`VITE_API_PROXY_TARGET`（ローカル開発で APIGW にプロキシする場合）、`VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN`, `VITE_AWS_REGION`
- 値は上記アウトプットを使用。Amplify は `/api` リライト + 環境変数、ローカルは Vite の proxy で `/api` → APIGW に転送

## テスト
- Lambda ロジックの単体テスト: `npm test`（Vitest）

## 次にやること
- 実ドメイン確定後、tfvars の callback/logout/allowed_origins を更新して dev/prod で再 apply
- Amplify の rewrite `/api/*` が dev/prod で期待通りか確認
- CI で plan/apply とフロントビルドを dev/prod で回す（prod は手動承認推奨）

## 進捗まとめ
やったこと
- frontend/backend/infra に分離（frontend は Vite+React、backend は TypeScript Lambda）
- Terraform を単一ディレクトリに集約し、backend-*.hcl で dev/prod のステートを分離
- Lambda を TypeScript で実装し、`./scripts/build-lambda.sh` で dist_bundle を生成して依存込みでデプロイ
- dev/prod で Terraform apply 済み（Hosted UI callback/logout/allowed_origins を Amplify ドメインへ更新、Lambda 500 の原因だった aws-sdk を同梱）
- フロントは Cognito Hosted UI ベースのログイン画面に変更（未ログイン時はログイン専用表示、デバッグ用に手動トークン入力欄も残置）
- 環境別のフロント `.env.*.example` を整備し、Amplify に VITE_* を流し込む設計に更新
- リポジトリを GitHub (`git@github.com:mugishiro/q-map.git`) へ push 済み

まだ未完了/今後やること
- 本番/開発の実ドメインが未確定（確定後 tfvars を差し替えて apply）
- Hosted UI のブランド調整（Cognito 標準のカスタマイズ範囲内でロゴ/色設定を検討）
- CI で環境別 plan/apply + フロントビルドを回すワークフローが未実装（dev/prod）
