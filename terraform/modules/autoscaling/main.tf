# ── Tier 1: ECS Cluster Auto Scaling (CAS) ───────────────────────────────────
# Registers the EC2 ASG as an ECS capacity provider with managed scaling.
# ECS calls ASG scale-out when tasks can't be placed (not enough EC2 capacity).
# Scale-in: ECS first DRAINs the instance (moves tasks off), removes scale-in
# protection, then ASG terminates — zero task interruption.

resource "aws_ecs_capacity_provider" "ec2" {
  name = "${var.environment}-chatbot-ec2-cp"

  auto_scaling_group_provider {
    auto_scaling_group_arn = var.asg_arn

    managed_scaling {
      status                    = "ENABLED"
      target_capacity           = 80      # aim for 80% cluster utilization
      minimum_scaling_step_size = 1
      maximum_scaling_step_size = 4
    }

    # Let CAS drain tasks before terminating (requires protect_from_scale_in=true on ASG)
    managed_termination_protection = "ENABLED"
  }
}

# Associate the capacity provider with the ECS cluster
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = var.ecs_cluster_name

  capacity_providers = [aws_ecs_capacity_provider.ec2.name]

  default_capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.ec2.name
    weight            = 1
    base              = 1
  }
}

# ── Tier 2: ECS Service Auto Scaling (task count) ────────────────────────────
# Scales the number of ECS tasks up/down based on CPU/Memory.
# When tasks scale out beyond available EC2 capacity, Tier 1 (CAS) adds hosts.

resource "aws_appautoscaling_target" "api" {
  max_capacity       = 16   # 8 hosts × 2 tasks/host
  min_capacity       = 4    # 2 hosts × 2 tasks/host
  resource_id        = "service/${var.ecs_cluster_name}/${var.api_service_name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.environment}-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "api_memory" {
  name               = "${var.environment}-api-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}

resource "aws_appautoscaling_target" "web" {
  max_capacity       = 8
  min_capacity       = 2
  resource_id        = "service/${var.ecs_cluster_name}/${var.web_service_name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "web_cpu" {
  name               = "${var.environment}-web-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension
  service_namespace  = aws_appautoscaling_target.web.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
