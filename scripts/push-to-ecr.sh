#!/bin/bash
# Push Docker images to AWS ECR

set -e

AWS_REGION=${AWS_REGION:-ap-southeast-5}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
IMAGE_TAG=${1:-latest}

echo "================================================"
echo "Pushing images to AWS ECR"
echo "================================================"
echo "Registry: $ECR_REGISTRY"
echo "Tag: $IMAGE_TAG"
echo ""

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
echo "✓ Logged in to ECR"
echo ""

# Function to tag and push
push_image() {
  local service=$1
  local local_tag="cashsouk-$service:local"
  local ecr_tag="$ECR_REGISTRY/cashsouk-$service:$IMAGE_TAG"
  
  echo "Pushing $service..."
  
  if ! docker image inspect $local_tag > /dev/null 2>&1; then
    echo "  ✗ Local image $local_tag not found. Build it first with ./scripts/build-all.sh"
    return 1
  fi
  
  docker tag $local_tag $ecr_tag
  docker push $ecr_tag
  
  # Also tag as latest if not already
  if [ "$IMAGE_TAG" != "latest" ]; then
    docker tag $local_tag "$ECR_REGISTRY/cashsouk-$service:latest"
    docker push "$ECR_REGISTRY/cashsouk-$service:latest"
    echo "  ✓ Pushed $service ($IMAGE_TAG and latest)"
  else
    echo "  ✓ Pushed $service"
  fi
}

# Push all images
push_image "landing"
push_image "investor"
push_image "issuer"
push_image "admin"
push_image "api"

echo ""
echo "================================================"
echo "All images pushed successfully!"
echo "================================================"
echo ""
echo "Images in ECR:"
echo "  $ECR_REGISTRY/cashsouk-landing:$IMAGE_TAG"
echo "  $ECR_REGISTRY/cashsouk-investor:$IMAGE_TAG"
echo "  $ECR_REGISTRY/cashsouk-issuer:$IMAGE_TAG"
echo "  $ECR_REGISTRY/cashsouk-admin:$IMAGE_TAG"
echo "  $ECR_REGISTRY/cashsouk-api:$IMAGE_TAG"
echo ""
echo "To deploy these images:"
echo "  1. Update ECS task definitions with new image tags"
echo "  2. Update ECS services to use new task definition revisions"
echo "  Or simply push to main branch to trigger GitHub Actions deployment"

