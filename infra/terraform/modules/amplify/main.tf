locals {
  app_name      = "${var.name_prefix}-app"
  branch_name   = "main"
  api_rewrite   = "${var.api_endpoint}/<*>"
  env_vars_base = {
    VITE_API_BASE_URL         = "/api"
    VITE_APP_STAGE            = var.stage
    VITE_COGNITO_USER_POOL_ID = var.user_pool_id
    VITE_COGNITO_CLIENT_ID    = var.user_pool_client_id
    VITE_COGNITO_DOMAIN       = var.cognito_domain
  }
}

resource "aws_amplify_app" "this" {
  name       = local.app_name
  platform   = "WEB"
  repository = "git@github.com:mugishiro/q-map.git"
  access_token = var.access_token

  custom_rule {
    source = "/api/<*>"
    target = local.api_rewrite
    status = "200"
  }

  custom_rule {
    source = "/<*>"
    target = "/index.html"
    status = "200"
  }
}

resource "aws_amplify_branch" "main" {
  app_id            = aws_amplify_app.this.id
  branch_name       = local.branch_name
  stage             = "DEVELOPMENT"
  enable_auto_build = true
  framework         = "Web"

  environment_variables = merge(local.env_vars_base, var.env_vars_extra)
}
