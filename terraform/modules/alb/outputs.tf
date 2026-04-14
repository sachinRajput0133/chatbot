output "dns_name"             { value = aws_lb.main.dns_name }
output "zone_id"              { value = aws_lb.main.zone_id }
output "arn_suffix"           { value = aws_lb.main.arn_suffix }
output "api_target_group_arn" { value = aws_lb_target_group.api.arn }
output "web_target_group_arn" { value = aws_lb_target_group.web.arn }
