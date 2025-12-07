variable "name_prefix" {
  description = "リソース名のプレフィックス（例: qmap-dev）"
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

variable "domain_prefix" {
  description = "Cognito Hosted UI のドメインプレフィックス（ユニーク必須）"
  type        = string
}

variable "callback_urls" {
  description = "Cognito の許可済みコールバック URL"
  type        = list(string)
}

variable "logout_urls" {
  description = "Cognito の許可済みログアウト URL"
  type        = list(string)
}
