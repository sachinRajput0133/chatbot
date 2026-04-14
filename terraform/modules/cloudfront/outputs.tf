output "domain_name"    { value = aws_cloudfront_distribution.main.domain_name }
output "hosted_zone_id" { value = aws_cloudfront_distribution.main.hosted_zone_id }
output "oac_id"         { value = aws_cloudfront_origin_access_control.s3.id }
