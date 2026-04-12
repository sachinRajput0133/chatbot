variable "environment"           {}
variable "ecs_cluster_name"      {}
variable "private_subnet_ids"    { type = list(string) }
variable "api_sg_id"             {}
variable "instance_profile_name" {}
variable "instance_type"         { default = "c5.large" }
variable "min_size"              { default = 2 }
variable "max_size"              { default = 8 }
variable "desired_capacity"      { default = 2 }
