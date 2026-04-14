data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

# A record → CloudFront
resource "aws_route53_record" "root" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  alias {
    name                   = var.cf_domain
    zone_id                = var.cf_zone_id
    evaluate_target_health = false
  }
}

# www → same CloudFront
resource "aws_route53_record" "www" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  alias {
    name                   = var.cf_domain
    zone_id                = var.cf_zone_id
    evaluate_target_health = false
  }
}
