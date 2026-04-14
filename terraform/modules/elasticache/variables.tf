variable "environment"        {}
variable "vpc_id"             {}
variable "private_subnet_ids" { type = list(string) }
variable "redis_sg_id"        {}
variable "node_type"          { default = "cache.t4g.medium" }
variable "num_replicas"       { default = 1 }
