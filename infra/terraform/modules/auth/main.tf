locals {
  user_pool_name = "${var.name_prefix}-user-pool"
  client_name    = "${var.name_prefix}-app-client"
  # Prefer explicit domain_prefix; fallback to name_prefix (e.g., qmap-dev)
  domain_prefix = var.domain_prefix != "" ? var.domain_prefix : replace(var.name_prefix, "/", "-")
}

resource "aws_cognito_user_pool" "this" {
  name = local.user_pool_name

  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 5
      max_length = 2048
    }
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  tags = var.tags
}

resource "aws_cognito_user_pool_client" "this" {
  name                         = local.client_name
  user_pool_id                 = aws_cognito_user_pool.this.id
  generate_secret              = false
  prevent_user_existence_errors = "ENABLED"

  allowed_oauth_flows                = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes               = ["openid", "email", "profile"]
  supported_identity_providers       = ["COGNITO"]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_pool_domain" "this" {
  domain       = local.domain_prefix
  user_pool_id = aws_cognito_user_pool.this.id
}
