variable "name_prefix" {
  description = "リソース名のプレフィックス（例: qmap-dev）"
  type        = string
}

variable "tags" {
  description = "共通タグ"
  type        = map(string)
}

variable "kms_key_arn" {
  description = "DynamoDB の SSE に使用する KMS キー ARN"
  type        = string
}
