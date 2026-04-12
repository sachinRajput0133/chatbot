output "cert_arn"           { value = aws_acm_certificate.main.arn }
output "validation_options" { value = aws_acm_certificate.main.domain_validation_options }
