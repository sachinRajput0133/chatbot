# OAC for S3 access (replaces legacy OAI)
resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.environment}-chatbot-s3-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "widget" {
  name = "${var.environment}-widget-cors"
  cors_config {
    access_control_allow_credentials = false
    access_control_allow_headers   { items = ["*"] }
    access_control_allow_methods   { items = ["GET", "HEAD"] }
    access_control_allow_origins   { items = ["*"] }
    origin_override = true
  }
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  aliases             = [var.domain_name, "www.${var.domain_name}"]
  price_class         = "PriceClass_200"  # US, EU, Asia
  web_acl_id          = var.waf_acl_arn
  http_version        = "http2and3"

  # Origin 1: ALB (API + Web)
  origin {
    domain_name = var.alb_dns
    origin_id   = "alb"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
    custom_header {
      name  = "X-Origin-Verify"
      value = "chatbot-${var.environment}-secret"
    }
  }

  # Origin 2: S3 static assets (widget.js)
  origin {
    domain_name              = var.assets_bucket
    origin_id                = "s3-assets"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  # Cache behavior: widget.js → S3 (long-lived, immutable per tag)
  ordered_cache_behavior {
    path_pattern           = "/widget/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-assets"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"  # CachingOptimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.widget.id
  }

  # Cache behavior: /api/chat/* → ALB, no caching (streaming/WebSocket)
  ordered_cache_behavior {
    path_pattern           = "/api/chat/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id           = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"  # CachingDisabled
    origin_request_policy_id  = "b689b0a8-53d0-40ab-baf2-68738e2966ac"  # AllViewer
  }

  # Cache behavior: /api/* → ALB, no caching
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id           = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id  = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  # Cache behavior: /ws/* → ALB, no caching
  ordered_cache_behavior {
    path_pattern           = "/ws/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id           = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id  = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  # Default behavior: → ALB (Next.js dashboard)
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id           = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id  = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_cert_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/"
    error_caching_min_ttl = 0
  }
}
