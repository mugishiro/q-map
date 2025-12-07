data "aws_caller_identity" "current" {}

locals {
  lambda_name = "${var.name_prefix}-bff"
  api_name    = "${var.name_prefix}-http-api"
  api_prefix  = "/v1"

  routes = {
    "GET ${local.api_prefix}/topics"                 = "GET ${local.api_prefix}/topics"
    "POST ${local.api_prefix}/topics"                = "POST ${local.api_prefix}/topics"
    "GET ${local.api_prefix}/topics/{topicId}"       = "GET ${local.api_prefix}/topics/{topicId}"
    "DELETE ${local.api_prefix}/topics/{topicId}"    = "DELETE ${local.api_prefix}/topics/{topicId}"
    "GET ${local.api_prefix}/topics/{topicId}/nodes" = "GET ${local.api_prefix}/topics/{topicId}/nodes"
    "GET ${local.api_prefix}/nodes/{nodeId}"         = "GET ${local.api_prefix}/nodes/{nodeId}"
    "GET ${local.api_prefix}/nodes/{nodeId}/path"    = "GET ${local.api_prefix}/nodes/{nodeId}/path"
    "POST ${local.api_prefix}/nodes"                 = "POST ${local.api_prefix}/nodes"
    "PATCH ${local.api_prefix}/nodes/{nodeId}"       = "PATCH ${local.api_prefix}/nodes/{nodeId}"
    "POST ${local.api_prefix}/chat"                  = "POST ${local.api_prefix}/chat"
    "POST ${local.api_prefix}/topics/{topicId}/summary" = "POST ${local.api_prefix}/topics/{topicId}/summary"
  }
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../../backend/dist"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "lambda_dynamo_kms" {
  name = "${var.name_prefix}-lambda-dynamo-kms"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${var.topics_table_name}",
          "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${var.nodes_table_name}",
          "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${var.user_settings_table_name}",
          "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${var.nodes_table_name}/index/*",
          "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${var.topics_table_name}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = [
          var.kms_key_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })
}

resource "aws_lambda_function" "bff" {
  function_name = local.lambda_name
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout       = var.lambda_timeout_seconds
  memory_size   = var.lambda_memory_mb

  environment {
    variables = merge({
      STAGE                    = var.stage
      REGION                   = var.region
      TOPICS_TABLE_NAME        = var.topics_table_name
      NODES_TABLE_NAME         = var.nodes_table_name
      USER_SETTINGS_TABLE_NAME = var.user_settings_table_name
      NODES_GSI1_NAME          = var.nodes_gsi1_name
      NODES_GSI2_NAME          = var.nodes_gsi2_name
      KMS_KEY_ARN              = var.kms_key_arn
    }, var.lambda_environment_extras)
  }

  depends_on = [
    aws_iam_role_policy.lambda_dynamo_kms
  ]
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.bff.function_name}"
  retention_in_days = var.lambda_log_retention_in_days
  tags              = var.tags
}

resource "aws_apigatewayv2_api" "http_api" {
  name          = local.api_name
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["authorization", "content-type"]
    allow_methods     = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    allow_origins     = var.allowed_origins
  }

  tags = var.tags
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  name             = "${var.name_prefix}-jwt"
  api_id           = aws_apigatewayv2_api.http_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [var.cognito_user_pool_client_id]
    issuer   = var.cognito_user_pool_issuer
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.bff.invoke_arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = local.routes

  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = each.value

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "this" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = var.stage
  auto_deploy = true

  tags = var.tags
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bff.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
