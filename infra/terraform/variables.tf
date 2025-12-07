variable "app" {
  description = "アプリケーション識別子（リソース命名に使用）"
  type        = string
  default     = "qmap"
}

variable "stage" {
  description = "デプロイステージ（例: dev/stg/prod）"
  type        = string
}

variable "region" {
  description = "AWS リージョン"
  type        = string
}

variable "default_tags" {
  description = "すべてのリソースに付与する追加タグ"
  type        = map(string)
  default     = {}
}

variable "domain_prefix" {
  description = "Cognito Hosted UI 用のドメインプレフィックス（ユニークである必要あり）"
  type        = string
  default     = "qmap"
}

variable "callback_urls" {
  description = "Cognito User Pool Client の許可済みコールバック URL"
  type        = list(string)
  default     = []
}

variable "logout_urls" {
  description = "Cognito User Pool Client の許可済みログアウト URL"
  type        = list(string)
  default     = []
}

variable "allowed_origins" {
  description = "HTTP API の CORS で許可するオリジン"
  type        = list(string)
  default     = []
}

variable "lambda_timeout_seconds" {
  description = "Lambda タイムアウト秒数"
  type        = number
  default     = 30
}

variable "lambda_memory_mb" {
  description = "Lambda メモリ割当（MB）"
  type        = number
  default     = 512
}

variable "lambda_environment_extras" {
  description = "Lambda に追加で注入する環境変数"
  type        = map(string)
  default     = {}
}

variable "lambda_log_retention_in_days" {
  description = "Lambda の CloudWatch Logs 保持日数"
  type        = number
  default     = 14
}

variable "amplify_access_token" {
  description = "Amplify が GitHub と接続するためのアクセストークン（PAT）。平文を tfvars に置かず環境変数経由で渡す。"
  type        = string
  default     = ""
  sensitive   = true
}
