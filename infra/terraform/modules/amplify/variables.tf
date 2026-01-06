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

variable "env_vars_extra" {
  description = "追加の環境変数 (string map)"
  type        = map(string)
  default     = {}
}

variable "access_token" {
  description = "GitHub へのアクセス用トークン（PAT）"
  type        = string
  default     = ""
  sensitive   = true
}
