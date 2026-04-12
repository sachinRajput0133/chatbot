variable "environment"            {}
variable "aws_region"             {}
variable "vpc_id"                 {}
variable "private_subnet_ids"     { type = list(string) }
variable "api_sg_id"              {}
variable "web_sg_id"              {}
variable "worker_sg_id"           {}
variable "api_ecr_url"            {}
variable "web_ecr_url"            {}
variable "worker_ecr_url"         {}
variable "image_tag"              { default = "latest" }
variable "task_execution_role"    {}
variable "task_role"              {}
variable "secret_arn"             {}
variable "api_target_group_arn"   {}
variable "web_target_group_arn"   {}
variable "domain_name"            {}
variable "next_public_api_url"    {}
variable "google_client_id"       {}
variable "stripe_publishable_key" {}
variable "razorpay_key_id"        {}
