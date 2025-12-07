variable "name_prefix" {
  description = "リソース名のプレフィックス（例: qmap-dev）"
  type        = string
}

variable "stage" {
  description = "ステージ（例: dev/stg/prod）"
  type        = string
}

variable "api_endpoint" {
  description = "API Gateway HTTP API のエンドポイント (例: https://xxx.execute-api.ap-northeast-1.amazonaws.com/dev)"
  type        = string
}

variable "user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  type        = string
}

variable "cognito_domain" {
  description = "Cognito Hosted UI ドメイン"
  type        = string
}

variable "env_vars_extra" {
  description = "追加の環境変数 (string map)"
  type        = map(string)
  default     = {}
}
