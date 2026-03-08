data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_ssm_parameter" "al2023_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

locals {
  resource_prefix = "${var.name}-${var.environment}"
  region          = var.aws_region != "" ? var.aws_region : data.aws_region.current.name
  ami_id          = coalesce(var.ami_id, data.aws_ssm_parameter.al2023_ami.value)

  vault_kms_key_id = var.create_kms_key ? aws_kms_key.vault[0].key_id : var.kms_key_id

  common_tags = merge(
    {
      Application = var.name
      Environment = var.environment
      ManagedBy   = "terraform"
      Component   = "vault"
    },
    var.common_tags
  )
}

resource "aws_kms_key" "vault" {
  count                   = var.create_kms_key ? 1 : 0
  description             = "KMS key for ${local.resource_prefix} Vault auto-unseal"
  deletion_window_in_days = var.kms_deletion_window_in_days
  enable_key_rotation     = true
  tags                    = local.common_tags
}

resource "aws_kms_alias" "vault" {
  count         = var.create_kms_key ? 1 : 0
  name          = "alias/${local.resource_prefix}-vault-unseal"
  target_key_id = aws_kms_key.vault[0].key_id
}

resource "aws_iam_role" "vault" {
  name = "${local.resource_prefix}-vault-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "vault" {
  name = "${local.resource_prefix}-vault-inline-policy"
  role = aws_iam_role.vault.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "KMSUnseal"
        Effect = "Allow"
        Action = [
          "kms:DescribeKey",
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = var.create_kms_key ? aws_kms_key.vault[0].arn : var.kms_key_id
      },
      {
        Sid    = "EC2Describe"
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeTags"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  count      = var.enable_ssm ? 1 : 0
  role       = aws_iam_role.vault.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "vault" {
  name = "${local.resource_prefix}-vault-profile"
  role = aws_iam_role.vault.name
}

resource "aws_security_group" "vault" {
  name        = "${local.resource_prefix}-vault-sg"
  description = "Vault cluster security group"
  vpc_id      = var.vpc_id

  ingress {
    description = "Vault API"
    from_port   = var.vault_api_port
    to_port     = var.vault_api_port
    protocol    = "tcp"
    cidr_blocks = length(var.allowed_ingress_cidrs) > 0 ? var.allowed_ingress_cidrs : ["10.0.0.0/8"]
  }

  ingress {
    description = "Vault cluster communication"
    from_port   = var.vault_cluster_port
    to_port     = var.vault_cluster_port
    protocol    = "tcp"
    self        = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.resource_prefix}-vault-sg" })
}

resource "aws_lb" "vault" {
  count              = var.create_nlb ? 1 : 0
  name               = substr("${replace(local.resource_prefix, "_", "-")}-nlb", 0, 32)
  internal           = var.nlb_internal
  load_balancer_type = "network"
  subnets            = var.nlb_subnet_ids

  tags = merge(local.common_tags, { Name = "${local.resource_prefix}-nlb" })
}

resource "aws_lb_target_group" "vault" {
  count       = var.create_nlb ? 1 : 0
  name        = substr("${replace(local.resource_prefix, "_", "-")}-tg", 0, 32)
  port        = var.vault_api_port
  protocol    = "TCP"
  target_type = "instance"
  vpc_id      = var.vpc_id

  health_check {
    protocol = "TCP"
    port     = "traffic-port"
  }

  tags = merge(local.common_tags, { Name = "${local.resource_prefix}-tg" })
}

resource "aws_lb_listener" "vault_tcp" {
  count             = var.create_nlb && var.acm_certificate_arn == null ? 1 : 0
  load_balancer_arn = aws_lb.vault[0].arn
  port              = var.vault_api_port
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.vault[0].arn
  }
}

resource "aws_lb_listener" "vault_tls" {
  count             = var.create_nlb && var.acm_certificate_arn != null ? 1 : 0
  load_balancer_arn = aws_lb.vault[0].arn
  port              = var.vault_api_port
  protocol          = "TLS"
  certificate_arn   = var.acm_certificate_arn
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.vault[0].arn
  }
}

resource "aws_launch_template" "vault" {
  name_prefix   = "${local.resource_prefix}-vault-"
  image_id      = local.ami_id
  instance_type = var.instance_type
  key_name      = var.ssh_key_name

  iam_instance_profile {
    arn = aws_iam_instance_profile.vault.arn
  }

  vpc_security_group_ids = [aws_security_group.vault.id]

  user_data = base64encode(
    templatefile("${path.module}/templates/user_data.sh.tftpl", {
      vault_version       = var.vault_version
      aws_region          = local.region
      kms_key_id          = local.vault_kms_key_id
      api_port            = var.vault_api_port
      cluster_port        = var.vault_cluster_port
      disable_tls         = var.vault_disable_tls
      extra_vault_config  = var.extra_vault_config
      cluster_tag_key     = "VaultCluster"
      cluster_tag_value   = local.resource_prefix
      enable_retry_scheme = var.vault_disable_tls ? "http" : "https"
    })
  )

  tag_specifications {
    resource_type = "instance"

    tags = merge(local.common_tags, {
      Name         = "${local.resource_prefix}-vault"
      VaultCluster = local.resource_prefix
    })
  }

  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "vault" {
  name                      = "${local.resource_prefix}-vault-asg"
  min_size                  = var.min_size
  max_size                  = var.max_size
  desired_capacity          = var.desired_capacity
  vpc_zone_identifier       = var.private_subnet_ids
  health_check_type         = "EC2"
  health_check_grace_period = 300
  target_group_arns         = var.create_nlb ? [aws_lb_target_group.vault[0].arn] : []

  launch_template {
    id      = aws_launch_template.vault.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${local.resource_prefix}-vault"
    propagate_at_launch = true
  }

  tag {
    key                 = "VaultCluster"
    value               = local.resource_prefix
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = local.common_tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

check "kms_input_validation" {
  assert {
    condition     = var.create_kms_key || (var.kms_key_id != null && trim(var.kms_key_id) != "")
    error_message = "Set kms_key_id when create_kms_key is false."
  }
}
