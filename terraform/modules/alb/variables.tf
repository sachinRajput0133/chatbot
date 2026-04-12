variable "environment"       {}
variable "vpc_id"            {}
variable "public_subnet_ids" { type = list(string) }
variable "alb_sg_id"         {}
variable "acm_cert_arn"      {}
