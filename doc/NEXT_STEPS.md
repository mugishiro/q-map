# 次にやること（v1 以降の優先タスク）

2025-01-XX 更新: later→chat 昇格（`/chat` nodeId 指定）と Ctrl/Cmd+Enter 送信を前提に反映済み。

## 現在のバックエンドの状態
- Lambda（Node.js/TypeScript）バッキングの BFF は `/v1/me/settings`, `/v1/topics`, `/v1/nodes`, `/v1/chat` を含む REST API を提供していて、トピック/ノードの作成・編集・削除、パス取得、チャット送信と later→chat 昇格が動作します。
- ユーザーの LLM API キーは KMS で暗号化して DynamoDB に保存され、OpenAI/OpenRouter/Anthropic/Gemini の各プロバイダに対応するコントローラが 1 リクエストで選択されます。
- Node の label は親階層と通し番号で自動生成され、`/nodes/{id}/path` でパスを取得可能、`/topics/{id}/nodes` では messages を含むか選択できるオプションがあります。
- `doc/NEXT_STEPS_EXECUTION.md` にも実装詳細を書き出しているので必要に応じて参照してください。
- LLM API キーの復号結果は Lambda 実行環境で `LLM_API_KEY_CACHE_TTL_MS`（デフォルト 5 分）だけキャッシュされ、KMS 呼び出しを抑えるようになっています。必要なら TTL を短くするか、メモリをクリアするリリースを含めて運用してください。

- CI/CD 強化  
  - GitHub Actions で Terraform plan/apply（prod は手動承認）とフロント build を自動化。plan 結果を PR にコメント。
  - Amplify プレビュー（PR）を有効化するか方針決定。
- ドメイン/配信まわり  
  - 独自ドメインを使う場合、APIGW/Amplify へカスタムドメイン・証明書を設定し、tfvars を更新して再 apply。CloudFront 経由で `/api/*` リライトする場合の設定を決める。
- バックエンドの堅牢化  
  - バリデーション/エラー整備、メッセージ長やレート制限をサーバ側で enforce。構造化ログとメトリクス（LLM latency/token in/out）を出力。
  - LLM 呼び出しのタイムアウト/リトライ、プロバイダごとのモデル選択 UI/API。
- フロント改善  
  - `/me/settings` 連携済みの設定画面を磨く（入力バリデーション、保存済みキーの再編集導線、エラー/トースト整理）。
  - Cognito Hosted UI のドメイン確定後にリダイレクト・エラー時の UX を確認し、フローを安定化する。
  - ツリー/チャットの UX 改善（ローディング表示、リトライ、メッセージ整形）。
- シークレット運用  
  - 平台固定の LLM キーを使う場合は Secrets Manager/SSM 経由で注入する設計に更新。Terraform state への露出を最小化。
