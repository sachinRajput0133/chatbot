#!/bin/bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
ENV="${ENV:-prod}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"

# Get ECR URLs from Terraform output
API_ECR=$(terraform -chdir=terraform output -raw api_ecr_url)
WEB_ECR=$(terraform -chdir=terraform output -raw web_ecr_url)
WORKER_ECR=$(terraform -chdir=terraform output -raw worker_ecr_url)

# Login to ECR
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "${API_ECR%%/*}"

# Build widget.js first (static asset served via CloudFront/S3)
if [ -d "apps/widget" ]; then
  echo "Building widget..."
  cd apps/widget && pnpm build && cd ../..
fi

# Build and push API image
echo "Building API image: $API_ECR:$IMAGE_TAG"
docker build -t "$API_ECR:$IMAGE_TAG" -t "$API_ECR:latest" \
  -f apps/api/Dockerfile apps/api/
docker push "$API_ECR:$IMAGE_TAG"
docker push "$API_ECR:latest"

# Build and push Worker image (same Dockerfile, different CMD in ECS task def)
echo "Building Worker image: $WORKER_ECR:$IMAGE_TAG"
docker build -t "$WORKER_ECR:$IMAGE_TAG" -t "$WORKER_ECR:latest" \
  -f apps/api/Dockerfile apps/api/
docker push "$WORKER_ECR:$IMAGE_TAG"
docker push "$WORKER_ECR:latest"

# Build and push Web image
echo "Building Web image: $WEB_ECR:$IMAGE_TAG"
docker build \
  --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-}" \
  --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID="${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-}" \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}" \
  --build-arg NEXT_PUBLIC_RAZORPAY_KEY_ID="${NEXT_PUBLIC_RAZORPAY_KEY_ID:-}" \
  -t "$WEB_ECR:$IMAGE_TAG" -t "$WEB_ECR:latest" \
  -f apps/web/Dockerfile apps/web/
docker push "$WEB_ECR:$IMAGE_TAG"
docker push "$WEB_ECR:latest"

# Upload widget.js to S3 assets bucket
ASSETS_BUCKET=$(terraform -chdir=terraform output -raw assets_bucket 2>/dev/null || echo "")
if [ -n "$ASSETS_BUCKET" ] && [ -f "apps/widget/dist/widget.js" ]; then
  echo "Uploading widget.js to s3://$ASSETS_BUCKET/widget/widget.js"
  aws s3 cp apps/widget/dist/widget.js "s3://$ASSETS_BUCKET/widget/widget.js" \
    --cache-control "public, max-age=300" \
    --content-type "application/javascript"
  # Invalidate CloudFront cache for widget
  CF_DIST_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?contains(Aliases.Items, '$(terraform -chdir=terraform output -raw cloudfront_domain 2>/dev/null || echo "")') == \`true\`].Id" \
    --output text 2>/dev/null || echo "")
  if [ -n "$CF_DIST_ID" ]; then
    aws cloudfront create-invalidation \
      --distribution-id "$CF_DIST_ID" \
      --paths "/widget/*" > /dev/null
    echo "CloudFront invalidation created for /widget/*"
  fi
fi

echo "Done. Images pushed with tag: $IMAGE_TAG"
