locals {
  alias_name = "alias/${var.app}-${var.stage}-kms"
}

resource "aws_kms_key" "main" {
  description         = "${var.app} ${var.stage} shared key"
  deletion_window_in_days = 7
  enable_key_rotation = true

  tags = var.tags
}

resource "aws_kms_alias" "main" {
  name          = local.alias_name
  target_key_id = aws_kms_key.main.id
}
