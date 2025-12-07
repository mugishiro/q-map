variable "app" {
  description = "アプリケーション識別子"
  type        = string
}

variable "stage" {
  description = "デプロイステージ"
  type        = string
}

variable "tags" {
  description = "共通タグ"
  type        = map(string)
}
