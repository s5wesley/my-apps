variable "name" {
  description = "Application name prefix."
  type        = string
  default     = "vault-aws"
}

variable "environment" {
  description = "Deployment environment label."
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region for Vault and KMS operations."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where Vault runs."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Vault instances."
  type        = list(string)
}

variable "nlb_subnet_ids" {
  description = "Subnet IDs for the Network Load Balancer."
  type        = list(string)
}

variable "allowed_ingress_cidrs" {
  description = "CIDRs allowed to connect to Vault API port 8200."
  type        = list(string)
  default     = []
}

variable "instance_type" {
  description = "EC2 instance type for Vault nodes."
  type        = string
  default     = "t3.medium"
}

variable "desired_capacity" {
  description = "Desired number of Vault nodes."
  type        = number
  default     = 3
}

variable "min_size" {
  description = "Minimum number of Vault nodes."
  type        = number
  default     = 3
}

variable "max_size" {
  description = "Maximum number of Vault nodes."
  type        = number
  default     = 5
}

variable "ami_id" {
  description = "Optional custom AMI ID. If null, latest Amazon Linux 2023 is used."
  type        = string
  default     = null
}

variable "vault_version" {
  description = "Vault binary version to install."
  type        = string
  default     = "1.17.5"
}

variable "create_kms_key" {
  description = "Create a dedicated KMS key for auto-unseal."
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "Existing KMS key ID or ARN for auto-unseal. Required when create_kms_key=false."
  type        = string
  default     = null
}

variable "kms_deletion_window_in_days" {
  description = "KMS key deletion window in days."
  type        = number
  default     = 30
}

variable "create_nlb" {
  description = "Create an NLB in front of Vault cluster."
  type        = bool
  default     = true
}

variable "nlb_internal" {
  description = "Whether NLB is internal."
  type        = bool
  default     = true
}

variable "acm_certificate_arn" {
  description = "Optional ACM cert ARN for TLS listener on NLB port 8200. If null, TCP listener is created."
  type        = string
  default     = null
}

variable "vault_api_port" {
  description = "Vault API listener port."
  type        = number
  default     = 8200
}

variable "vault_cluster_port" {
  description = "Vault cluster communication port."
  type        = number
  default     = 8201
}

variable "vault_disable_tls" {
  description = "Set true only when terminating TLS at a trusted upstream and in private networks."
  type        = bool
  default     = true
}

variable "extra_vault_config" {
  description = "Additional Vault HCL appended to config file."
  type        = string
  default     = ""
}

variable "ssh_key_name" {
  description = "Optional SSH key pair name for instances."
  type        = string
  default     = null
}

variable "enable_ssm" {
  description = "Attach AmazonSSMManagedInstanceCore policy to EC2 role."
  type        = bool
  default     = true
}

variable "common_tags" {
  description = "Common tags to apply to all resources."
  type        = map(string)
  default     = {}
}
