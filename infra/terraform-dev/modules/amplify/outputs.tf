output "app_id" {
  description = "Amplify App ID"
  value       = aws_amplify_app.this.id
}

output "default_domain" {
  description = "Amplify デフォルトドメイン"
  value       = aws_amplify_app.this.default_domain
}

output "branch_main_url" {
  description = "main ブランチの Amplify URL"
  value       = "https://${aws_amplify_app.this.default_domain}"
}
