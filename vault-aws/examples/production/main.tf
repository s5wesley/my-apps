provider "aws" {
  region = "us-east-1"
}

module "vault_aws" {
  source = "../../"

  name                  = "vault-aws"
  environment           = "production"
  aws_region            = "us-east-1"
  vpc_id                = "vpc-xxxxxxxx"
  private_subnet_ids    = ["subnet-private-a", "subnet-private-b", "subnet-private-c"]
  nlb_subnet_ids        = ["subnet-lb-a", "subnet-lb-b", "subnet-lb-c"]
  allowed_ingress_cidrs = ["10.0.0.0/8"]

  desired_capacity = 3
  min_size         = 3
  max_size         = 5

  create_kms_key      = true
  create_nlb          = true
  nlb_internal        = true
  acm_certificate_arn = null
  vault_disable_tls   = true

  common_tags = {
    Team       = "platform"
    CostCenter = "security"
  }
}
