output "kms_key_arn" {
  description = "共通で使用する KMS キー ARN"
  value       = module.base.kms_key_arn
}

output "topics_table_name" {
  description = "Topics DynamoDB テーブル名"
  value       = module.data.topics_table_name
}

output "nodes_table_name" {
  description = "Nodes DynamoDB テーブル名"
  value       = module.data.nodes_table_name
}

output "user_settings_table_name" {
  description = "UserSettings DynamoDB テーブル名"
  value       = module.data.user_settings_table_name
}

output "http_api_endpoint" {
  description = "HTTP API のエンドポイント URL"
  value       = module.api.http_api_endpoint
}

output "lambda_function_name" {
  description = "BFF Lambda 関数名"
  value       = module.api.lambda_function_name
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.auth.user_pool_id
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.auth.user_pool_client_id
}

output "cognito_user_pool_issuer" {
  description = "Cognito User Pool Issuer URL"
  value       = module.auth.user_pool_issuer
}

output "cognito_domain" {
  description = "Cognito Hosted UI ドメイン"
  value       = module.auth.cognito_domain
}

output "amplify_app_id" {
  description = "Amplify App ID"
  value       = module.amplify.app_id
}

output "amplify_default_domain" {
  description = "Amplify デフォルトドメイン"
  value       = module.amplify.default_domain
}
