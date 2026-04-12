terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "chatbot-terraform-state"       # create manually first
    key            = "prod/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "chatbot-terraform-locks"       # create manually first
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "chatbot-saas"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Second provider in us-east-1 — required for ACM cert used by CloudFront
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = {
      Project     = "chatbot-saas"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

module "networking" {
  source      = "./modules/networking"
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
  azs         = var.availability_zones
}

module "ecr" {
  source      = "./modules/ecr"
  environment = var.environment
}

module "acm" {
  source      = "./modules/acm"
  domain_name = var.domain_name
  providers   = { aws = aws.us_east_1 }  # CloudFront needs us-east-1 cert
}

module "route53" {
  source      = "./modules/route53"
  domain_name = var.domain_name
  alb_dns     = module.alb.dns_name
  alb_zone_id = module.alb.zone_id
  cf_domain   = module.cloudfront.domain_name
  cf_zone_id  = module.cloudfront.hosted_zone_id
}

module "rds" {
  source             = "./modules/rds"
  environment        = var.environment
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  db_sg_id           = module.networking.db_sg_id
  db_name            = "chatbot_db"
  db_username        = var.db_username
  db_password        = var.db_password
  min_capacity       = 0.5
  max_capacity       = 16
}

module "elasticache" {
  source             = "./modules/elasticache"
  environment        = var.environment
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  redis_sg_id        = module.networking.redis_sg_id
  node_type          = "cache.t4g.medium"
  num_replicas       = 1
}

module "s3" {
  source      = "./modules/s3"
  environment = var.environment
  cf_oac_id   = module.cloudfront.oac_id
}

module "iam" {
  source         = "./modules/iam"
  environment    = var.environment
  aws_account_id = data.aws_caller_identity.current.account_id
  aws_region     = var.aws_region
  secret_arn     = module.secrets.secret_arn
  uploads_bucket = module.s3.uploads_bucket_name
}

module "secrets" {
  source      = "./modules/secrets"
  environment = var.environment
  secret_values = {
    DATABASE_URL            = "postgresql+asyncpg://${var.db_username}:${var.db_password}@${module.rds.cluster_endpoint}:5432/chatbot_db"
    REDIS_URL               = "redis://${module.elasticache.primary_endpoint}:6379/0"
    CELERY_BROKER_URL       = "redis://${module.elasticache.primary_endpoint}:6379/1"
    CELERY_RESULT_BACKEND   = "redis://${module.elasticache.primary_endpoint}:6379/2"
    JWT_SECRET_KEY          = var.jwt_secret_key
    ANTHROPIC_API_KEY       = var.anthropic_api_key
    OPENAI_API_KEY          = var.openai_api_key
    GROQ_API_KEY            = var.groq_api_key
    STRIPE_SECRET_KEY       = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET   = var.stripe_webhook_secret
    RAZORPAY_KEY_SECRET     = var.razorpay_key_secret
    RAZORPAY_WEBHOOK_SECRET = var.razorpay_webhook_secret
    RESEND_API_KEY          = var.resend_api_key
    GOOGLE_CLIENT_ID        = var.google_client_id
    GOOGLE_CLIENT_SECRET    = var.google_client_secret
    PLATFORM_ADMIN_EMAIL    = var.platform_admin_email
    PLATFORM_ADMIN_PASSWORD = var.platform_admin_password
    S3_BUCKET_NAME          = module.s3.uploads_bucket_name
    S3_REGION               = var.aws_region
    APP_URL                 = "https://${var.domain_name}"
    FRONTEND_URL            = "https://${var.domain_name}"
  }
}

module "alb" {
  source            = "./modules/alb"
  environment       = var.environment
  vpc_id            = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
  alb_sg_id         = module.networking.alb_sg_id
  acm_cert_arn      = module.acm.cert_arn
}

module "ecs" {
  source               = "./modules/ecs"
  environment          = var.environment
  aws_region           = var.aws_region
  vpc_id               = module.networking.vpc_id
  private_subnet_ids   = module.networking.private_subnet_ids
  api_sg_id            = module.networking.api_sg_id
  web_sg_id            = module.networking.web_sg_id
  worker_sg_id         = module.networking.worker_sg_id
  api_ecr_url          = module.ecr.api_repository_url
  web_ecr_url          = module.ecr.web_repository_url
  worker_ecr_url       = module.ecr.worker_repository_url
  image_tag            = var.image_tag
  task_execution_role  = module.iam.task_execution_role_arn
  task_role            = module.iam.task_role_arn
  secret_arn           = module.secrets.secret_arn
  api_target_group_arn = module.alb.api_target_group_arn
  web_target_group_arn = module.alb.web_target_group_arn
  domain_name          = var.domain_name
  next_public_api_url  = "https://${var.domain_name}"
  google_client_id     = var.google_client_id
  stripe_publishable_key = var.stripe_publishable_key
  razorpay_key_id      = var.razorpay_key_id
}

module "ec2_asg" {
  source                = "./modules/ec2_asg"
  environment           = var.environment
  ecs_cluster_name      = module.ecs.cluster_name
  private_subnet_ids    = module.networking.private_subnet_ids
  api_sg_id             = module.networking.api_sg_id
  instance_profile_name = module.iam.ec2_instance_profile_name
  instance_type         = "c5.large"
  min_size              = 2
  max_size              = 8
  desired_capacity      = 2
}

module "autoscaling" {
  source           = "./modules/autoscaling"
  environment      = var.environment
  ecs_cluster_name = module.ecs.cluster_name
  ecs_cluster_id   = module.ecs.cluster_id
  api_service_name = module.ecs.api_service_name
  web_service_name = module.ecs.web_service_name
  asg_name         = module.ec2_asg.asg_name
  asg_arn          = module.ec2_asg.asg_arn
}

module "waf" {
  source      = "./modules/waf"
  environment = var.environment
  providers   = { aws = aws.us_east_1 }  # CloudFront WAF must be us-east-1
}

module "cloudfront" {
  source         = "./modules/cloudfront"
  environment    = var.environment
  alb_dns        = module.alb.dns_name
  domain_name    = var.domain_name
  acm_cert_arn   = module.acm.cert_arn
  uploads_bucket = module.s3.uploads_bucket_domain
  assets_bucket  = module.s3.assets_bucket_domain
  waf_acl_arn    = module.waf.web_acl_arn
}

module "monitoring" {
  source           = "./modules/monitoring"
  environment      = var.environment
  api_service_name = module.ecs.api_service_name
  ecs_cluster_name = module.ecs.cluster_name
  rds_cluster_id   = module.rds.cluster_id
  alb_arn_suffix   = module.alb.arn_suffix
  alarm_email      = var.alarm_email
}

data "aws_caller_identity" "current" {}
