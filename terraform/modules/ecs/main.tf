resource "aws_ecs_cluster" "main" {
  name = "${var.environment}-chatbot"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.environment}/chatbot-api"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${var.environment}/chatbot-web"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.environment}/chatbot-worker"
  retention_in_days = 30
}

# ── API Task Definition (EC2, bridge network) ─────────────────────────────────
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.environment}-chatbot-api"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = 1024  # 1 vCPU
  memory                   = 1920  # leaves ~128 MB for ECS agent on 2 GB host
  execution_role_arn       = var.task_execution_role
  task_role_arn            = var.task_role

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${var.api_ecr_url}:${var.image_tag}"
    essential = true
    cpu       = 1024
    memory    = 1920
    # hostPort = 0 → dynamic port mapping (bridge mode); ECS registers instance:port with target group
    portMappings = [{ containerPort = 8000, hostPort = 0, protocol = "tcp" }]
    command = ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

    secrets     = [{ name = "APP_SECRETS", valueFrom = var.secret_arn }]
    environment = [{ name = "APP_ENV", value = "production" }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

resource "aws_ecs_service" "api" {
  name                   = "${var.environment}-chatbot-api"
  cluster                = aws_ecs_cluster.main.id
  task_definition        = aws_ecs_task_definition.api.arn
  desired_count          = 4
  launch_type            = "EC2"
  enable_execute_command = true

  load_balancer {
    target_group_arn = var.api_target_group_arn
    container_name   = "api"
    container_port   = 8000
  }

  ordered_placement_strategy {
    type  = "spread"
    field = "attribute:ecs.availability-zone"
  }
  ordered_placement_strategy {
    type  = "binpack"
    field = "cpu"
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }
}

# ── Web Task Definition (EC2, bridge) ─────────────────────────────────────────
resource "aws_ecs_task_definition" "web" {
  family                   = "${var.environment}-chatbot-web"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = 512
  memory                   = 896
  execution_role_arn       = var.task_execution_role
  task_role_arn            = var.task_role

  container_definitions = jsonencode([{
    name      = "web"
    image     = "${var.web_ecr_url}:${var.image_tag}"
    essential = true
    cpu       = 512
    memory    = 896
    portMappings = [{ containerPort = 3000, hostPort = 0, protocol = "tcp" }]
    command   = ["node", "server.js"]

    environment = [
      { name = "NODE_ENV",                           value = "production" },
      { name = "NEXT_PUBLIC_API_URL",                value = var.next_public_api_url },
      { name = "NEXT_PUBLIC_GOOGLE_CLIENT_ID",       value = var.google_client_id },
      { name = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", value = var.stripe_publishable_key },
      { name = "NEXT_PUBLIC_RAZORPAY_KEY_ID",        value = var.razorpay_key_id },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.web.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "web"
      }
    }
  }])
}

resource "aws_ecs_service" "web" {
  name            = "${var.environment}-chatbot-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = 4
  launch_type     = "EC2"

  load_balancer {
    target_group_arn = var.web_target_group_arn
    container_name   = "web"
    container_port   = 3000
  }

  ordered_placement_strategy {
    type  = "spread"
    field = "attribute:ecs.availability-zone"
  }

  deployment_circuit_breaker { enable = true; rollback = true }

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }
}

# ── Celery Worker Task Definition ─────────────────────────────────────────────
resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.environment}-chatbot-worker"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = 1024
  memory                   = 1920
  execution_role_arn       = var.task_execution_role
  task_role_arn            = var.task_role

  container_definitions = jsonencode([{
    name      = "worker"
    image     = "${var.worker_ecr_url}:${var.image_tag}"
    essential = true
    cpu       = 1024
    memory    = 1920
    command = [
      "celery", "-A", "app.workers.celery_app", "worker",
      "-Q", "embeddings", "--concurrency=2", "--loglevel=info"
    ]

    secrets     = [{ name = "APP_SECRETS", valueFrom = var.secret_arn }]
    environment = [{ name = "APP_ENV", value = "production" }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])
}

resource "aws_ecs_service" "worker" {
  name            = "${var.environment}-chatbot-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 2
  launch_type     = "EC2"

  ordered_placement_strategy {
    type  = "spread"
    field = "attribute:ecs.availability-zone"
  }

  deployment_circuit_breaker { enable = true; rollback = true }

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }
}
