# 非機能・運用ポリシー (v1)

機能ドキュメントを補完する、認証・レート制御・運用/監視などの方針をまとめる。

2025-01-XX 更新: `/chat` の later→chat 昇格（nodeId 指定）とフロントの Ctrl/Cmd+Enter 送信を前提に整合を確認。

## 認証・認可
- 認証: Cognito 等の JWT を `Authorization: Bearer <JWT>` で必須。`userId` は JWT から解決。
- 認可: すべてのリソースは `userId` に紐づく。Topic/Node 取得時は `userId` 照合で早期拒否。
- CORS: SPA ドメインを Allow-Origin に限定。`/api/*` のみ許可。Credential は不要想定。
- ログインフロー（Cognito Hosted UI + PKCE 想定）:
  - 未ログイン時は Cognito Hosted UI へリダイレクト。
  - 認証後、認可コードが付与され Vercel ドメインに戻る。
  - フロントがコード＋PKCE でトークン交換し、ID/Access/Refresh トークンを取得。
  - Access Token(JWT) を `Authorization: Bearer` に付け `/api/*` を呼ぶ。API Gateway で検証。
  - 401/403 ならリフレッシュ→再ログインへ。ログアウトは Cognito サインアウトエンドポイントにリダイレクトし、ローカルトークンも破棄。
- サインアップ（初回訪問時の流れ）:
  - 「ログイン」押下で Cognito Hosted UI に遷移し、サインアップ（メール+パスワード）を実施。
  - 必要に応じてメール検証コードを入力 → アカウント確定。
  - サインアップ完了後、そのまま認可コードフローで SPA にリダイレクトされ、ID/Access トークンを取得。
  - バックエンドは `sub` を userId として扱い、メールアドレスは DB に保存しない（Cognito 管理、PII 最小化）。

## レート制御・保護
- API Gateway レベルで IP+userId ベースの基本レートリミットを設定（例: 10 RPS バースト 20）。
- LLM 呼び出し失敗時のリトライ: プロバイダのレートエラーのみ指数バックオフ 2 回まで。`LLM_REQUEST_FAILED` を返し UI で再送を促す。
- サイズ制限: `message` はサーバ側で文字数/トークン簡易上限をチェック（例: 4096 chars 目安）し、超過時 `VALIDATION_ERROR`。
- ペイロード上限: 1 リクエストの JSON 目安 1MB 未満。ノード一覧はページネーションを利用し、過大レスポンスを防ぐ。

## バージョニング / URL
- API ベースパス: `/v1` 固定。後方互換が破れる変更は `/v2` を追加で公開。
- フロントのルーティング: `/topics/:topicId/nodes/:nodeId` を基本とし、URL 共有を想定。

## ロギング・監視
- アプリログ: Lambda で構造化 JSON ログ（リクエスト ID, userId 省略形, topicId/nodeId 省略形, endpoint, latency）。
- ログフィールド例: `{ requestId, userIdShort, topicId, nodeId, path, status, latencyMs, tokenEstimateIn, tokenEstimateOut }`（PII は含めない）。
- メトリクス: API Gateway/Lambda/DynamoDB/LLM 呼び出しの成功率・レイテンシ・エラー率を CloudWatch Metrics に送信。
- アラート: 5xx 増加、LLM 呼び出し失敗率上昇、DynamoDB Throttling で通知（SNS/Slack）。

## データ保持・削除
- Topic 削除時は配下 Nodes を論理削除または物理削除（v1 は物理削除でも可）。ユーザー退会時は全削除。
- API キーは KMS で暗号化保存し、復号は実行時のみ。レスポンスは常にマスク。

## パフォーマンス指針
- Node パス取得: 深さ 10〜20 までを想定。GetItem の再帰 or BatchGet で許容。さらに深くなる場合は要約ノード導入を検討。
- 子ノード取得: GSI1(parentId/createdAt) を用意。Topic 全件 Query でも数百ノード規模なら許容。
- 初期トークン削減: 実施しない。リクエスト時にトークン見積もりをログ出力し、閾値超過が見え始めたら summary ノードを導入。

## エラーポリシー
- 形式: `{"error": {"code": "...", "message": "..."}}` を統一（詳細は API.md）。
- 主なコード: `UNAUTHENTICATED`, `FORBIDDEN`, `TOPIC_NOT_FOUND`, `NODE_NOT_FOUND`, `LLM_API_KEY_MISSING`, `LLM_REQUEST_FAILED`, `VALIDATION_ERROR`.
