variable "name_prefix" {
  description = "リソース名プレフィックス（例: qmap-dev）"
  type        = string
}

variable "stage" {
  description = "デプロイステージ"
  type        = string
}

variable "region" {
  description = "AWS リージョン"
  type        = string
}

variable "tags" {
  description = "共通タグ"
  type        = map(string)
}

variable "kms_key_arn" {
  description = "KMS キー ARN"
  type        = string
}

variable "topics_table_name" {
  description = "Topics DynamoDB テーブル名"
  type        = string
}

variable "nodes_table_name" {
  description = "Nodes DynamoDB テーブル名"
  type        = string
}

variable "user_settings_table_name" {
  description = "UserSettings DynamoDB テーブル名"
  type        = string
}

variable "nodes_gsi1_name" {
  description = "Nodes テーブル GSI1 名"
  type        = string
}

variable "nodes_gsi2_name" {
  description = "Nodes テーブル GSI2 名"
  type        = string
}

variable "allowed_origins" {
  description = "HTTP API の CORS で許可するオリジン"
  type        = list(string)
}

variable "lambda_timeout_seconds" {
  description = "Lambda タイムアウト秒数"
  type        = number
}

variable "lambda_memory_mb" {
  description = "Lambda メモリ割当（MB）"
  type        = number
}

variable "lambda_environment_extras" {
  description = "Lambda に追加注入する環境変数"
  type        = map(string)
}

variable "lambda_log_retention_in_days" {
  description = "Lambda の CloudWatch Logs 保持日数"
  type        = number
}
