# QMap ドキュメント索引

主要ドキュメントの入口。まずは SPEC → USER_FLOW → API の順で読むと全体像が掴める。

- 2025-01-XX アップデート: 「あとで聞く」ノードは選択後に送信するとその場で chat に昇格（label/parentId 維持、messages を今回の2件で上書き）。チャット入力は Ctrl+Enter/Cmd+Enter でも送信可能。各ドキュメントは現状コードに合わせて更新済み。

- `SPEC.md`: 機能仕様・画面構成・LLM 連携ルール。
- `USER_FLOW.md`: 1 ユーザーの操作を時系列で追った具体例。
- `API.md`: REST API 仕様（リクエスト/レスポンス例、重要エンドポイント）。
- `DYNAMODB_DESIGN.md`: テーブル構成と GSI 設計。
- `ARCHITECTURE.md`: インフラ構成（Amplify Hosting/CDN + API Gateway/Lambda/DynamoDB/KMS/LLM）。
- `DECISIONS.md`: v1 の意思決定（ID, messages, トークン方針, URL ルーティング）。
- `NON_FUNCTIONAL.md`: 非機能方針（認証・レート制御・運用/監視・CORS/バージョニング等）。
- `NEXT_STEPS.md`: 直近の着手タスク（Amplify設定、CI/CD、IaC、認証統合、モック実装、計測）。
- `IMPLEMENTATION_PLAN.md`: v1 の進め方（IaC, 認証統合, Lambda BFF, フロント, 計測, CI/CD, 後続検討）。
- `VERCEL.md`: Vercel への移行手順（Hostingのみ / Cognito維持）。

読む順序の目安:
1) SPEC → USER_FLOW でユースケース理解  
2) API で I/F を把握  
3) DYNAMODB_DESIGN と ARCHITECTURE で実装イメージ  
4) DECISIONS / NON_FUNCTIONAL でポリシー・運用を確認
