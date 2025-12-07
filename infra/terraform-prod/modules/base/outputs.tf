output "kms_key_arn" {
  description = "共通 KMS キー ARN"
  value       = aws_kms_key.main.arn
}
