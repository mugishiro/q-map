output "user_settings_table_name" {
  description = "UserSettings テーブル名"
  value       = local.user_settings_table_name
}

output "topics_table_name" {
  description = "Topics テーブル名"
  value       = local.topics_table_name
}

output "nodes_table_name" {
  description = "Nodes テーブル名"
  value       = local.nodes_table_name
}

output "nodes_gsi1_name" {
  description = "Nodes テーブルの GSI1 名（parentId/createdAt）"
  value       = local.nodes_gsi1_name
}

output "nodes_gsi2_name" {
  description = "Nodes テーブルの GSI2 名（userId/updatedAt）"
  value       = local.nodes_gsi2_name
}

output "topics_gsi1_name" {
  description = "Topics テーブルの GSI1 名（userId/updatedAt）"
  value       = local.topics_gsi1_name
}
