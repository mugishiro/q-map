# NEXT_STEPS 実行ガイド

`doc/NEXT_STEPS.md` の粒度を上げ、すぐ着手できるようにした具体化メモ。前提仕様は `SPEC.md` / `USER_FLOW.md` / `API.md` を踏襲する。

2025-01-XX 更新: later→chat 昇格（`/chat` で nodeId 指定）と Ctrl/Cmd+Enter 送信を現行仕様として反映。

## Amplify Hosting / ルーティング
- 現状: Amplify デフォルトドメインを使用。`modules/amplify` で `/api/<*>` → APIGW (`https://{api}/{stage}/<*>`) の rewrite を設定済み。Amplify 環境では `VITE_API_BASE_URL=/api` を渡し、ローカル開発は `.env.dev` で APIGW 直叩き（例: `https://14z0sascyi.../dev`）。  
- カスタムドメインを入れる場合:  
  - Amplify に独自ドメイン + HTTPS 証明書を設定。  
  - CloudFront の Rewrites で `/api/<*>` → `https://{api-domain}/{stage}/<*>` を 200 rewrite に設定し、`VITE_API_BASE_URL=/api` とする。  
  - `/<*>` → `/index.html` で SPA fallback。`/api/*` はキャッシュ無効。
- 環境変数（Amplify 環境に設定、秘匿情報は置かない）:
  - `VITE_API_BASE_URL`（Amplify は `/api`, ローカルは APIGW 直）、`VITE_APP_STAGE`
  - `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REDIRECT_URI`, `VITE_AWS_REGION`

## Lambda 環境変数・シークレットの扱い
- 環境変数（例）:
  - `TOPICS_TABLE_NAME`, `NODES_TABLE_NAME`, `USER_SETTINGS_TABLE_NAME`
  - `NODES_GSI1_NAME`（parentId/createdAt 用）, `NODES_GSI2_NAME`（任意: userId/updatedAt）
  - `KMS_KEY_ARN`
  - `DEFAULT_LLM_PROVIDER`, `DEFAULT_LLM_MODEL`（未実装の場合はコード側デフォルト openai/gpt-4o-mini を使用）
  - `LLM_REQUEST_TIMEOUT_MS`, `MAX_MESSAGE_CHARS`, `REQUEST_LOG_LEVEL`（必要に応じて追加）
  - `STAGE`, `REGION`
- シークレット:
  - ユーザーの LLM API キーは DynamoDB に暗号化保存し、復号は Lambda 実行時のみ（KMS）。
  - プラットフォーム側の固定シークレット（例: OpenRouter プロキシ鍵）を持つ場合は Secrets Manager に保存し、Lambda に特定のシークレット ARN だけ参照権限を付与。Amplify 環境変数には秘匿情報を置かない。

## CI/CD 方針
- フロント（Amplify Hosting 接続）:
  - main ブランチ: Amplify のビルド & デプロイ（`npm ci && npm run build`）。環境変数は Amplify の環境ごとに設定済み。Preview 有効化は要判断。
  - PR/ブランチ: Amplify Preview を使うか、別環境を作成するか方針決定。
- バックエンド（Terraform + GitHub Actions 想定）:
  - リモートステート: S3 バケット（例: `qmap-tfstate-<region>`）+ DynamoDB ロックテーブル（例: `qmap-terraform-locks`）を作成し、全環境で共有する。ステートはワークスペース or backend key を stage ごとに分離。
  - ワークフロー例: `terraform fmt -check` → `terraform init -backend-config=...` → `terraform validate` → `terraform plan -var-file=dev|prod.tfvars`。PR では plan のみ、main マージ時に apply（prod は手動承認）。
  - main マージで `stage=prod`、develop 等で `stage=dev`。`stage` は `-var stage=...` で渡すか、`terraform workspace select dev|prod` で切替える。
  - デプロイ成果物（API エンドポイント/テーブル名/KMS ARN など）は `terraform output -json` を GitHub Actions の outputs に載せるか、SSM Parameter Store に書き出し、Amplify ビルドで参照。

## IaC（Terraform を想定）
- モジュール分割案（`modules/` 配下を想定）:
  - `base`: KMS キー、共通ログ/タグ設定。
  - `data`: DynamoDB テーブル（UserSettings/Topics/Nodes + GSI1/任意 GSI2）。
  - `auth`: Cognito User Pool / Domain / User Pool Client。
  - `api`: Lambda（BFF）+ API Gateway HTTP API（JWT オーソライザー）、Lambda への環境変数付与、Dynamo/KMS/Secrets への権限付与。
- ルート構成: `main.tf` で各モジュールを呼び出し、`stage`/`region`/`app`（例: `qmap`）を共通変数として渡す。命名規則 `${app}-${stage}-${resource}` を徹底（例: `qmap-dev-topics`, `qmap-prod-nodes-gsi1`）。
- デプロイ手順の雛形:
  - `terraform init -backend-config="bucket=qmap-tfstate-<region>" -backend-config="dynamodb_table=qmap-terraform-locks" -backend-config="key=qmap/<stage>/terraform.tfstate"`
  - `terraform workspace select <stage> || terraform workspace new <stage>`（もしくは backend の key で stage を分離）
  - `terraform plan -var stage=<stage> -out tfplan`
  - `terraform apply tfplan`
- 変数管理: `locals` でリソース名を組み立て、環境変数（Lambda 用）は `aws_lambda_function` の `environment` ブロックでセット。秘匿値は Secrets Manager/KMS と IAM ポリシーで制御する。

## 認証統合（Cognito + API Gateway）
- Cognito:
  - Hosted UI + PKCE を実装済み（フロントで code パラメータを交換）。ドメイン例: `qmap-dev.auth.ap-northeast-1.amazoncognito.com` / `qmap-prod.auth.ap-northeast-1.amazoncognito.com`。
  - User Pool Client: public client, callback/logout に Amplify ドメイン（`/` と `/callback`/`/logout`）と `http://localhost:5173/` を登録。Scope: `openid email profile`。Access Token 1h, Refresh 30d 目安（現状の Terraform 設定）。
- API Gateway HTTP API:
  - JWT オーソライザーで issuer=各 UserPool, audience=ClientId。全ルートに適用。
  - CORS は tfvars の `allowed_origins` で管理（現在は Amplify ドメインと localhost）。

## バックエンド実装メモ（現状）
- Lambda(Node.js/TypeScript, aws-sdk v2) + API Gateway HTTP API。ルートは `/v1/topics`, `/nodes`, `/chat`, `/me/settings` 等を実装済み。ID は `topic#uuid` / `node#uuid`、ラベルは階層＋通し番号で生成。
- LLM 呼び出しは OpenAI / OpenRouter / Anthropic / Gemini に対応。ユーザー提供の API Key を KMS で暗号化保存し、復号して使用。
- TODO: バリデーション拡充、レート制御、ログ/メトリクス強化、タイムアウト設定。

## 計測・トークン見積もり
- LLM 呼び出し前後で `tokenEstimateIn`（送信メッセージ文字数/4 など簡易推定）と `tokenEstimateOut`（レスポンス文字数/4）を算出しログに載せる。将来的にプロバイダごとの正式カウンタに差し替え。
- CloudWatch メトリクスに `LLM_REQUEST_COUNT`, `LLM_REQUEST_FAILED`, `LLM_LATENCY_MS`, `LLM_TOKEN_IN/OUT` をカスタムメトリクスで送信し、異常時アラートを設定。
- API Gateway レートリミット（例: 10 RPS バースト 20）をステージ設定で有効化。message 文字数上限（例: 4096 chars）をサーバ側バリデーションに入れる。
