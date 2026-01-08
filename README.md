# QMap
QMap is a service that organizes LLM conversations as a tree.
You can review chat history visually, branch from any point, and keep
"ask later" notes to revisit. After login, registering an LLM API key
enables chat with your chosen provider.

## Stack
- Frontend: Vite + React
- Backend: AWS Lambda (Node.js/TypeScript) + API Gateway (HTTP API)
- Auth: Cognito Hosted UI (PKCE)
- Data: DynamoDB + KMS
- IaC: Terraform
- Hosting: Vercel

## 日本語
QMap は、LLM との対話をツリーで整理するサービスです。
LLM とのチャット履歴を視覚的に確認でき、必要な地点から対話を分岐できます。
また、あとで聞く内容をメモしておくことも可能です。
ログイン後に LLM API キーを登録することで、各 LLM とのチャットが有効になります。
