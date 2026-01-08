# QMap

QMap は、会話をツリーで整理しながら学習・調査を進めるための
シンプルなチャット UI です。ログイン後に LLM 設定（API キー）を
登録するとチャット機能が有効になります。

## 構成
- フロント: Vite + React
- バックエンド: AWS Lambda (Node.js/TypeScript) + API Gateway (HTTP API)
- 認証: Cognito Hosted UI (PKCE)
- データ: DynamoDB + KMS
- IaC: Terraform
- ホスティング: Vercel

## ディレクトリ
- `frontend`: SPA (Vite + React)
- `backend`: Lambda (TypeScript)
- `infra/terraform`: Terraform (dev/prod)
- `doc`: 仕様・設計・運用メモ

## ローカル開発（フロント）
```
cd frontend
npm ci
npm run dev
```

API Gateway を直接叩く場合は `frontend/.env.local` に以下を設定:
```
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=https://<api-id>.execute-api.ap-northeast-1.amazonaws.com/dev
VITE_AWS_REGION=ap-northeast-1
VITE_COGNITO_DOMAIN=<your-cognito-domain>
VITE_COGNITO_CLIENT_ID=<your-client-id>
```

## バックエンド（ビルド/テスト）
```
./scripts/build-lambda.sh
```

```
cd backend
npm ci
npm test
```

## デプロイ
### Vercel
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- 環境変数: `VITE_COGNITO_*`, `VITE_AWS_REGION` を Vercel に設定
- `/api/*` のリライトは `vercel.json` を参照

### Terraform（dev/prod）
```
./scripts/build-lambda.sh
cd infra/terraform
terraform init -reconfigure -backend-config=backend-dev.hcl
terraform apply -var-file=dev.tfvars
```

prod は `backend-prod.hcl` と `prod.tfvars` に切り替え。

## ドキュメント
詳細は `doc/README.md` を参照。
