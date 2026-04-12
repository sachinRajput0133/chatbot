resource "aws_wafv2_web_acl" "main" {
  name  = "${var.environment}-chatbot-waf"
  scope = "CLOUDFRONT"  # must be deployed in us-east-1

  default_action {
    allow {}
  }

  # Rule 1: AWS managed common rule set (SQLi, XSS, etc.)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # Rule 2: Bot control — count only initially (monitor before blocking)
  rule {
    name     = "AWSManagedRulesBotControlRuleSet"
    priority = 2
    override_action { count {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesBotControlRuleSet"
        vendor_name = "AWS"
        managed_rule_group_configs {
          aws_managed_rules_bot_control_rule_set {
            inspection_level = "COMMON"
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "BotControl"
      sampled_requests_enabled   = true
    }
  }

  # Rule 3: Rate limit on /api/chat (widget endpoint) — 500 per 5 min per IP
  rule {
    name     = "ChatRateLimit"
    priority = 3
    action { block {} }
    statement {
      rate_based_statement {
        limit              = 500
        aggregate_key_type = "IP"
        scope_down_statement {
          byte_match_statement {
            search_string         = "/api/chat"
            positional_constraint = "STARTS_WITH"
            field_to_match { uri_path {} }
            text_transformation { priority = 0; type = "NONE" }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "ChatRateLimit"
      sampled_requests_enabled   = true
    }
  }

  # Rule 4: Rate limit on all /api/* — 2000 per 5 min per IP
  rule {
    name     = "APIRateLimit"
    priority = 4
    action { block {} }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
        scope_down_statement {
          byte_match_statement {
            search_string         = "/api/"
            positional_constraint = "STARTS_WITH"
            field_to_match { uri_path {} }
            text_transformation { priority = 0; type = "NONE" }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "APIRateLimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.environment}-chatbot-waf"
    sampled_requests_enabled   = true
  }
}

output "web_acl_arn" { value = aws_wafv2_web_acl.main.arn }
