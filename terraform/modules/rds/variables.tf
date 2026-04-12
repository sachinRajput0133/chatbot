variable "environment"        {}
variable "vpc_id"             {}
variable "private_subnet_ids" { type = list(string) }
variable "db_sg_id"           {}
variable "db_name"            { default = "chatbot_db" }
variable "db_username"        {}
variable "db_password"        { sensitive = true }
variable "min_capacity"       { default = 0.5 }
variable "max_capacity"       { default = 16 }
