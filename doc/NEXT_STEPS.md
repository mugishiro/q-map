# 次にやること（v1 以降の優先タスク）

2025-01-XX 更新: later→chat 昇格（`/chat` nodeId 指定）と Ctrl/Cmd+Enter 送信を前提に反映済み。

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
  - ツリー/チャットの UX 改善（ローディング表示、リトライ、メッセージ整形）。
- シークレット運用  
  - 平台固定の LLM キーを使う場合は Secrets Manager/SSM 経由で注入する設計に更新。Terraform state への露出を最小化。
