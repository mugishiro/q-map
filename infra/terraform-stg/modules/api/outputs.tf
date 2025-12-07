locals {
  endpoint = "${aws_apigatewayv2_api.http_api.api_endpoint}/${aws_apigatewayv2_stage.this.name}"
}

output "http_api_endpoint" {
  description = "HTTP API エンドポイント (ステージ付き)"
  value       = local.endpoint
}

output "lambda_function_name" {
  description = "BFF Lambda 関数名"
  value       = aws_lambda_function.bff.function_name
}
