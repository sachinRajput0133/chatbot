#!/bin/bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"

CLUSTER=$(terraform -chdir=terraform output -raw ecs_cluster_name)

echo "Deploying image tag: $IMAGE_TAG to cluster: $CLUSTER"

# Update ECS task definitions with new image tag via targeted apply
terraform -chdir=terraform apply \
  -var="image_tag=$IMAGE_TAG" \
  -target=module.ecs.aws_ecs_task_definition.api \
  -target=module.ecs.aws_ecs_task_definition.web \
  -target=module.ecs.aws_ecs_task_definition.worker \
  -auto-approve

# Force new deployments for all services
for svc in api web worker; do
  SVC_NAME="${CLUSTER}-chatbot-${svc}"
  echo "Triggering new deployment: $SVC_NAME"
  aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$SVC_NAME" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null
done

# Wait for API service to stabilize
echo "Waiting for API service to stabilize (this may take a few minutes)..."
aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services "${CLUSTER}-chatbot-api" \
  --region "$AWS_REGION"

echo "Deployment complete. Running tasks:"
aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "${CLUSTER}-chatbot-api" "${CLUSTER}-chatbot-web" "${CLUSTER}-chatbot-worker" \
  --region "$AWS_REGION" \
  --query "services[].{Service:serviceName, Running:runningCount, Desired:desiredCount}" \
  --output table
