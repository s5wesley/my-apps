output "vault_asg_name" {
  description = "Autoscaling group name for Vault cluster."
  value       = aws_autoscaling_group.vault.name
}

output "vault_security_group_id" {
  description = "Security group ID attached to Vault instances."
  value       = aws_security_group.vault.id
}

output "vault_kms_key_id" {
  description = "KMS key ID used for Vault auto-unseal."
  value       = local.vault_kms_key_id
}

output "vault_kms_key_arn" {
  description = "KMS key ARN used for Vault auto-unseal when created by this module."
  value       = var.create_kms_key ? aws_kms_key.vault[0].arn : null
}

output "nlb_dns_name" {
  description = "NLB DNS name if created."
  value       = var.create_nlb ? aws_lb.vault[0].dns_name : null
}

output "vault_endpoint" {
  description = "Vault endpoint URL via NLB when available."
  value = var.create_nlb ? (
    var.acm_certificate_arn != null
    ? "https://${aws_lb.vault[0].dns_name}:${var.vault_api_port}"
    : "tcp://${aws_lb.vault[0].dns_name}:${var.vault_api_port}"
  ) : null
}
