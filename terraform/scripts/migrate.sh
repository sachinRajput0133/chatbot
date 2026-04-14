#!/bin/bash
set -euo pipefail
# Run Alembic migrations via ECS Exec on a running API task.
# Requires: aws ecs execute-command with SSM session manager plugin installed.

AWS_REGION="${AWS_REGION:-ap-south-1}"
CLUSTER=$(terraform -chdir=terraform output -raw ecs_cluster_name)
SVC_NAME="${CLUSTER}-chatbot-api"

echo "Finding running API task in cluster: $CLUSTER"

TASK_ARN=$(aws ecs list-tasks \
  --cluster "$CLUSTER" \
  --service-name "$SVC_NAME" \
  --desired-status RUNNING \
  --query "taskArns[0]" \
  --output text \
  --region "$AWS_REGION")

if [ "$TASK_ARN" = "None" ] || [ -z "$TASK_ARN" ]; then
  echo "ERROR: No running API tasks found. Is the service deployed?"
  exit 1
fi

echo "Running migrations on task: $TASK_ARN"
aws ecs execute-command \
  --cluster "$CLUSTER" \
  --task "$TASK_ARN" \
  --container api \
  --interactive \
  --command "alembic upgrade head" \
  --region "$AWS_REGION"
