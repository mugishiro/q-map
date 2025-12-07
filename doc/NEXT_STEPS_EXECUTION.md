# NEXT_STEPS 実行ガイド

`doc/NEXT_STEPS.md` の粒度を上げ、すぐ着手できるようにした具体化メモ。前提仕様は `SPEC.md` / `USER_FLOW.md` / `API.md` を踏襲する。

## Amplify Hosting / ルーティング
- Rewrites & Redirects（優先順）:
  - `/api/<*>` → `https://{api-domain}/{stage}/<*>` （200: rewrite）。API Gateway のカスタムドメインを設定し、Amplify 側では API ドメインを環境変数で差し替え。
  - `/<*>` → `/index.html` （200: SPA fallback）。
  - 404/robots などは通常の SPA 設定に従う。`/api/*` は CDN キャッシュを無効化。
- フロントの環境変数例（Amplify Hosting の環境変数で注入。秘匿情報は置かない）:
  - `VITE_API_BASE_URL=/api`（CloudFront→APIGW 経由を前提）
  - `VITE_APP_STAGE=dev|stg|prod`

## Lambda 環境変数・シークレットの扱い
- 環境変数（例）:
  - `TOPICS_TABLE_NAME`, `NODES_TABLE_NAME`, `USER_SETTINGS_TABLE_NAME`
  - `NODES_GSI1_NAME`（parentId/createdAt 用）, `NODES_GSI2_NAME`（任意: userId/updatedAt）
  - `KMS_KEY_ARN`
  - `DEFAULT_LLM_PROVIDER`, `DEFAULT_LLM_MODEL`
  - `LLM_REQUEST_TIMEOUT_MS`, `MAX_MESSAGE_CHARS`, `REQUEST_LOG_LEVEL`
  - `STAGE`, `REGION`
- シークレット:
  - ユーザーの LLM API キーは DynamoDB に暗号化保存し、復号は Lambda 実行時のみ（KMS）。
  - プラットフォーム側の固定シークレット（例: OpenRouter プロキシ鍵）を持つ場合は Secrets Manager に保存し、Lambda に特定のシークレット ARN だけ参照権限を付与。Amplify 環境変数には秘匿情報を置かない。

## CI/CD 方針
- フロント（Amplify Hosting 接続）:
  - main ブランチ: Amplify のビルド & デプロイ（`npm ci && npm run build` を想定）。環境変数は Amplify の環境ごとに設定。
  - PR/ブランチ: Amplify の Preview 機能でプレビュー URL を自動発行し、main 以外はデプロイしない。
- バックエンド（Terraform + GitHub Actions 想定）:
  - リモートステート: S3 バケット（例: `qmap-tfstate-<region>`）+ DynamoDB ロックテーブル（例: `qmap-terraform-locks`）を作成し、全環境で共有する。ステートはワークスペース or backend key を stage ごとに分離。
  - ワークフロー例: `terraform fmt -check` → `terraform init -backend-config=...` → `terraform validate` → `terraform plan -var stage=$STAGE -out tfplan`。PR では plan までを出力、main/develop マージで `terraform apply tfplan`。
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
  - Hosted UI + PKCE。ドメイン例: `auth-${stage}.qmap.example.com`。
  - User Pool Client: public client, no client secret。リダイレクト URI は Amplify ドメインとローカル開発用（例: `http://localhost:5173/`）を登録。
  - Scope: `openid email profile`。Access Token 1h、Refresh 30d 目安。
- API Gateway HTTP API:
  - JWT オーソライザーで `issuer = https://cognito-idp.<region>.amazonaws.com/<userPoolId>`、`audience = <userPoolClientId>`。
  - すべてのルートにオーソライザーを適用し、`Authorization: Bearer <AccessToken>` を必須にする。
  - CORS は SPA ドメインのみに許可。`/api/*` で `GET/POST/PATCH/DELETE` と `Authorization,Content-Type` ヘッダを許可。

## バックエンド初期実装（ハッピーケースの流れ）
- 技術スタック案: Lambda(Node.js/TypeScript) + API Gateway。`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-kms`, `ulid`, `zod` を利用。
- ルーティング実装メモ:
  - `GET /topics`: userId で Topics を Query、`limit/cursor` を LastEvaluatedKey からエンコードして返す。
  - `POST /topics`: name バリデーション → topicId/ULID 生成 → Topics に Put → 201 返却。
  - `GET /topics/{id}`: GetItem(userId, topicId)。なければ 404。
  - `DELETE /topics/{id}`: Topics + Nodes を削除（論理削除の場合は `deletedAt` を設定）。GSI1 で子ノードをたどって一括削除。
  - `GET /topics/{id}/nodes`: Query by topicId。`includeMessages=true` の場合は messages も返却。
  - `GET /nodes/{id}`: GetItem by nodeId（PK=topicId, SK=nodeId）。認可チェックで userId も検証。
  - `GET /nodes/{id}/path`: 対象ノードから parentId を再帰し、ルートまで messages を含めて返却（先頭が古い順になるよう reverse）。
  - `POST /nodes` (later): parentId 配下に type="later" ノードを作成。LLM 呼び出しなし、messages=[]。
  - `PATCH /nodes/{id}`: title/summary のみ UpdateItem。label/ULID/messages は不変。
  - `POST /chat`: baseNodeId からパスを構築し、messages を連結 + 現在の user 入力で LLM 呼び出し → 応答とともに type="chat" ノードを作成し保存。
- ロギング: リクエスト ID, userId 短縮, topicId/nodeId, endpoint, latencyMs, tokenEstimateIn/Out, provider, model, LLM latency を構造化 JSON で出力。

## 計測・トークン見積もり
- LLM 呼び出し前後で `tokenEstimateIn`（送信メッセージ文字数/4 など簡易推定）と `tokenEstimateOut`（レスポンス文字数/4）を算出しログに載せる。将来的にプロバイダごとの正式カウンタに差し替え。
- CloudWatch メトリクスに `LLM_REQUEST_COUNT`, `LLM_REQUEST_FAILED`, `LLM_LATENCY_MS`, `LLM_TOKEN_IN/OUT` をカスタムメトリクスで送信し、異常時アラートを設定。
- API Gateway レートリミット（例: 10 RPS バースト 20）をステージ設定で有効化。message 文字数上限（例: 4096 chars）をサーバ側バリデーションに入れる。
