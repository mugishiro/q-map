locals {
  user_settings_table_name = "${var.name_prefix}-user-settings"
  topics_table_name        = "${var.name_prefix}-topics"
  nodes_table_name         = "${var.name_prefix}-nodes"
  nodes_gsi1_name          = "${var.name_prefix}-nodes-gsi1"
  nodes_gsi2_name          = "${var.name_prefix}-nodes-gsi2"
  topics_gsi1_name         = "${var.name_prefix}-topics-gsi1"
}

resource "aws_dynamodb_table" "user_settings" {
  name         = local.user_settings_table_name
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "topics" {
  name         = local.topics_table_name
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "userId"
  range_key = "topicId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "topicId"
    type = "S"
  }

  attribute {
    name = "updatedAt"
    type = "S"
  }

  global_secondary_index {
    name            = local.topics_gsi1_name
    hash_key        = "userId"
    range_key       = "updatedAt"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "nodes" {
  name         = local.nodes_table_name
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "topicId"
  range_key = "nodeId"

  attribute {
    name = "topicId"
    type = "S"
  }

  attribute {
    name = "nodeId"
    type = "S"
  }

  attribute {
    name = "parentId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "updatedAt"
    type = "S"
  }

  global_secondary_index {
    name            = local.nodes_gsi1_name
    hash_key        = "parentId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = local.nodes_gsi2_name
    hash_key        = "userId"
    range_key       = "updatedAt"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }

  tags = var.tags
}
