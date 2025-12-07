locals {
  issuer = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
}

output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.this.arn
}

output "user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.this.id
}

output "user_pool_issuer" {
  description = "Cognito User Pool Issuer URL"
  value       = local.issuer
}

output "cognito_domain" {
  description = "Cognito Hosted UI ドメイン"
  value       = aws_cognito_user_pool_domain.this.domain
}
