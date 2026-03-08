# vault-aws Terraform Module

Production-focused Terraform module to deploy HashiCorp Vault on AWS with:
- EC2 Auto Scaling cluster in private subnets
- Integrated Storage (Raft)
- AWS KMS auto-unseal
- Optional Network Load Balancer endpoint
- IAM and security group hardening baseline

## Module name
This application/module is named **vault-aws**.

## Requirements
- Terraform >= 1.6
- AWS provider >= 5.0

## Usage
```hcl
module "vault_aws" {
  source = "./vault-aws"

  name               = "vault-aws"
  environment        = "production"
  aws_region         = "us-east-1"
  vpc_id             = "vpc-xxxxxxxx"
  private_subnet_ids = ["subnet-a", "subnet-b", "subnet-c"]
  nlb_subnet_ids     = ["subnet-a", "subnet-b", "subnet-c"]

  allowed_ingress_cidrs = ["10.0.0.0/8"]

  desired_capacity = 3
  min_size         = 3
  max_size         = 5

  create_kms_key = true
  create_nlb     = true
  nlb_internal   = true

  # Set this when you want TLS termination at NLB.
  acm_certificate_arn = null

  # Keep true only for private/trusted networks or when TLS terminates upstream.
  vault_disable_tls = true

  common_tags = {
    Team = "platform"
  }
}
```

## Notes
- For strict end-to-end TLS, set `vault_disable_tls = false` and provide Vault certificates via AMI/bootstrap process (plus optional NLB TLS at edge).
- Unseal key management uses AWS KMS. If `create_kms_key = false`, provide `kms_key_id`.
- Initial Vault initialization and unseal are operator workflows and intentionally not automated by this module.

## Files
- `versions.tf`: Terraform and provider constraints
- `variables.tf`: Inputs
- `main.tf`: Core infrastructure resources
- `outputs.tf`: Useful outputs
- `templates/user_data.sh.tftpl`: Node bootstrap and Vault service setup
- `examples/production/main.tf`: Reference deployment
