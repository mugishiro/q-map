# QMap インフラ構成メモ

- IaC: Terraform（単一ディレクトリ: `infra/terraform`、環境切替は backend-*.hcl + tfvars）
- 状態管理: S3 バケット `qmap-tfstate-710146154969-apne1` + DynamoDB ロックテーブル `qmap-terraform-locks`（backend-dev.hcl / backend-prod.hcl で key を dev/prod に分離）
- デプロイ対象: Amplify（GitHub `git@github.com:mugishiro/q-map.git`）、API Gateway (HTTP API)、Cognito、DynamoDB、KMS、Lambda
- Lambda 実装: `backend/src/index.ts`（TypeScript, Dynamo/KMS/LLM 連携。`npm run build:lambda` で `backend/dist` を生成）

## 実施済み
- Terraform コードを `infra/terraform` に集約し、backend-*.hcl で環境別 key を指定
- dev/prod で `terraform init/apply` 済み（アクセス用 PAT は実行時に環境変数で注入、state は環境別 key で分離）
- Terraform lock ファイルを各環境で生成し、.gitignore で lambda.zip を無視
- 環境は dev/prod の 2 つに集約（stg は廃止）

## 環境別アウトプット
dev (`backend-dev.hcl`, backend key `qmap/dev/terraform.tfstate`)
- API: `https://14z0sascyi.execute-api.ap-northeast-1.amazonaws.com/dev`
- Amplify: `dxhqhxj18etwj.amplifyapp.com`
- Cognito: Pool `ap-northeast-1_gVMXb6uCj`, Client `29cvjr5vsgkf52l735gadvev6c`, Domain `qmap-qmap-dev`

prod (`backend-prod.hcl`, backend key `qmap/prod/terraform.tfstate`)
- API: `https://4s9u0m4qqh.execute-api.ap-northeast-1.amazonaws.com/prod`
- Amplify: `d3c16q2d8f1ppt.amplifyapp.com`
- Cognito: Pool `ap-northeast-1_FBspriqA4`, Client `2abc2a87nrgd9elom60k609054`, Domain `qmap-qmap-prod`

## 運用フロー（Terraform）
1. コードは `infra/terraform` のみを使用（環境切替は backend-*.hcl と tfvars で指定）
2. 変更があれば tfvars を修正（例: callback/logout/allowed_origins を実ドメインに差し替え）
3. 実行例（dev）  
   ```bash
   npm run build:lambda  # backend を dist にビルド（全環境で共通利用）
   cd infra/terraform
   TF_VAR_amplify_access_token="<GitHub_PAT>" terraform init -reconfigure -backend-config=backend-dev.hcl
   TF_VAR_amplify_access_token="<GitHub_PAT>" terraform apply -var-file=dev.tfvars
   ```
   ※ prod は `backend-prod.hcl` と `prod.tfvars` に切り替えるだけ
4. 出力の確認: `terraform output`

## ドメイン未決の場合
- 現状は仮の `*.qmap.example.com` とローカル `http://localhost:5173` を tfvars に設定済み
- 本番/開発ドメインが決まり次第、各 tfvars を更新し再度 `terraform apply`

## フロント連携メモ
- 必要な環境変数（例）: `VITE_API_BASE_URL`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN`
- 値は上記アウトプットを使用。Amplify コンソールの環境変数にも同様に設定

## テスト
- Lambda ロジックの単体テスト: `npm test`（Vitest）

## 次にやること
- 実ドメイン確定後、tfvars の callback/logout/allowed_origins を更新して dev/prod で再 apply
- Amplify の rewrite `/api/*` が dev/prod で期待通りか確認
- CI で plan/apply とフロントビルドを dev/prod で回す（prod は手動承認推奨）

## 進捗まとめ
やったこと
- ディレクトリを frontend/backend/infra に分離（frontend は Vite+React、backend は TypeScript Lambda）
- Terraform を単一ディレクトリに集約し、backend-*.hcl で dev/prod のステートを分離
- Lambda を TypeScript にリライトし、`npm run build:lambda` → Terraform で `backend/dist` をデプロイ
- dev/prod で Terraform apply 済み（Lambda コード更新）
- フロントを追加（トピック一覧/ツリー/パス/チャット UI、JWT 手入力で API 呼び出し可）
- 環境別のフロント `.env.*.example` を追加（API/Cognito 情報のサンプル）
- リポジトリを GitHub (`git@github.com:mugishiro/q-map.git`) へ push 済み

まだ未完了/今後やること
- 本番/開発の実ドメインが未確定（確定後 tfvars を差し替えて apply）
- フロントの認証フローは JWT 手入力の簡易版のため、Cognito Hosted UI 連携とトークン取得を実装する
- Amplify 環境変数（VITE_〜）を環境ごとに設定し、CI/Amplify ビルドに組み込む
- CI で環境別 plan/apply + フロントビルドを回すワークフローが未実装（dev/prod）
