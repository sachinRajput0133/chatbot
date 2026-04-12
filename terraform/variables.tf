variable "aws_region" {
  default = "ap-south-1"
}

variable "environment" {
  default = "prod"
}

variable "domain_name" {
  description = "Primary domain, e.g. chatbot.yourdomain.com"
}

variable "vpc_cidr" {
  default = "10.0.0.0/16"
}

variable "availability_zones" {
  default = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
}

variable "image_tag" {
  description = "Docker image tag to deploy (e.g. git SHA)"
  default     = "latest"
}

variable "db_username" {
  default = "chatbot"
}

variable "db_password" {
  sensitive = true
}

variable "jwt_secret_key" { sensitive = true }

variable "anthropic_api_key" {
  sensitive = true
  default   = ""
}

variable "openai_api_key" {
  sensitive = true
  default   = ""
}

variable "groq_api_key" {
  sensitive = true
  default   = ""
}

variable "stripe_secret_key" {
  sensitive = true
  default   = ""
}

variable "stripe_publishable_key" {
  default = ""
}

variable "stripe_webhook_secret" {
  sensitive = true
  default   = ""
}

variable "razorpay_key_id" {
  default = ""
}

variable "razorpay_key_secret" {
  sensitive = true
  default   = ""
}

variable "razorpay_webhook_secret" {
  sensitive = true
  default   = ""
}

variable "resend_api_key" {
  sensitive = true
  default   = ""
}

variable "google_client_id" {
  default = ""
}

variable "google_client_secret" {
  sensitive = true
  default   = ""
}

variable "platform_admin_email" {
  default = "admin@chatbot.platform"
}

variable "platform_admin_password" {
  sensitive = true
}

variable "alarm_email" {
  description = "Email for CloudWatch alerts"
}
