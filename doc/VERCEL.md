# Vercel への移行（Hostingのみ / Cognito維持）

## 概要
- フロントは Vercel で配信、API は既存の API Gateway を継続。
- `/api/*` は `vercel.json` の rewrite で API Gateway に転送。
- 認証は Cognito Hosted UI + PKCE をそのまま使用。

## Vercel の設定
### Project Settings
- Root Directory: `frontend`
- Framework Preset: Vite
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `dist`

### Environment Variables
以下を Vercel に設定:
- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_CLIENT_ID`
- `VITE_COGNITO_DOMAIN`
- `VITE_AWS_REGION`

`VITE_API_BASE_URL` は未設定でOK（デフォルト `/api` を利用）。

### Rewrite（API Gateway）
`vercel.json` の rewrite が prod を指す前提。dev を使う場合は destination を差し替える。
- prod: `https://4s9u0m4qqh.execute-api.ap-northeast-1.amazonaws.com/prod/$1`
- dev: `https://csdq8anoqk.execute-api.ap-northeast-1.amazonaws.com/dev/$1`

## Cognito の callback/logout と CORS
Vercel のドメインに合わせて Terraform の tfvars を更新する。

- `callback_urls` に Vercel URL を追加
- `logout_urls` に Vercel URL を追加
- `allowed_origins` に Vercel URL を追加（API Gateway の CORS）

例（prod）:
```
callback_urls  = ["https://<project>.vercel.app"]
logout_urls    = ["https://<project>.vercel.app"]
allowed_origins = ["https://<project>.vercel.app"]
```

適用例:
```
cd infra/terraform
./scripts/build-lambda.sh
terraform init -reconfigure -backend-config=backend-prod.hcl
terraform apply -var-file=prod.tfvars
```

## 補足
- Preview/PR 環境で Cognito を使う場合、callback/logout/allowed_origins に Preview ドメインも追加する。
- Amplify の利用を完全に止める場合は、Terraform の `module "amplify"` を削除して apply する。
