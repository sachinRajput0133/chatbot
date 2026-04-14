resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.environment}-redis-subnet"
  subnet_ids = var.private_subnet_ids
}

resource "aws_cloudwatch_log_group" "redis" {
  name              = "/aws/elasticache/${var.environment}/chatbot"
  retention_in_days = 7
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.environment}-chatbot-redis"
  description          = "Redis for chatbot session cache + Celery broker"

  node_type          = var.node_type
  num_cache_clusters = var.num_replicas + 1  # 1 primary + replicas
  engine_version     = "7.1"
  port               = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [var.redis_sg_id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  automatic_failover_enabled = true
  multi_az_enabled           = true

  snapshot_retention_limit = 3
  snapshot_window          = "04:00-05:00"

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }
}
