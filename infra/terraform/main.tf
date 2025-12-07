terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # S3 バケット / DynamoDB ロックテーブルは `terraform init -backend-config=...` で設定する
  backend "s3" {}
}

provider "aws" {
  region = var.region

  default_tags {
    tags = local.default_tags
  }
}

locals {
  app         = var.app
  stage       = var.stage
  name_prefix = "${local.app}-${local.stage}"

  default_tags = merge(
    {
      App   = local.app
      Stage = local.stage
    },
    var.default_tags,
  )
}

module "base" {
  source = "./modules/base"

  app   = local.app
  stage = local.stage
  tags  = local.default_tags
}

module "data" {
  source = "./modules/data"

  name_prefix = local.name_prefix
  tags        = local.default_tags
  kms_key_arn = module.base.kms_key_arn
}

module "auth" {
  source = "./modules/auth"

  name_prefix   = local.name_prefix
  region        = var.region
  tags          = local.default_tags
  domain_prefix = var.domain_prefix
  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls
}

module "api" {
  source = "./modules/api"

  name_prefix                   = local.name_prefix
  stage                         = local.stage
  region                        = var.region
  tags                          = local.default_tags
  kms_key_arn                   = module.base.kms_key_arn
  topics_table_name             = module.data.topics_table_name
  nodes_table_name              = module.data.nodes_table_name
  user_settings_table_name      = module.data.user_settings_table_name
  nodes_gsi1_name               = module.data.nodes_gsi1_name
  nodes_gsi2_name               = module.data.nodes_gsi2_name
  cognito_user_pool_arn         = module.auth.user_pool_arn
  cognito_user_pool_client_id   = module.auth.user_pool_client_id
  cognito_user_pool_issuer      = module.auth.user_pool_issuer
  allowed_origins               = var.allowed_origins
  lambda_timeout_seconds        = var.lambda_timeout_seconds
  lambda_memory_mb              = var.lambda_memory_mb
  lambda_environment_extras     = var.lambda_environment_extras
  lambda_log_retention_in_days  = var.lambda_log_retention_in_days
}
