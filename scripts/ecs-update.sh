#!/bin/bash

set -e

COMMIT_SHA=$1
CLUSTER=${ECS_CLUSTER:-"shoraka-prod"}
REGISTRY=${ECR_REGISTRY}
APP_NAME="shoraka-p2p"

if [ -z "$COMMIT_SHA" ]; then
  echo "Usage: $0 <commit-sha>"
  exit 1
fi

SERVICES=("api" "investor" "borrower" "admin")

for SERVICE in "${SERVICES[@]}"; do
  echo "Updating service: ${SERVICE}"
  
  TASK_FAMILY="${APP_NAME}-${SERVICE}"
  IMAGE="${REGISTRY}/${APP_NAME}-portal-${SERVICE}:${COMMIT_SHA}"
  
  if [ "$SERVICE" = "api" ]; then
    IMAGE="${REGISTRY}/${APP_NAME}-${SERVICE}:${COMMIT_SHA}"
  fi
  
  TASK_DEF=$(aws ecs describe-task-definition --task-definition "${TASK_FAMILY}" --query 'taskDefinition')
  
  NEW_TASK_DEF=$(echo "$TASK_DEF" | jq --arg IMAGE "$IMAGE" '
    .containerDefinitions[0].image = $IMAGE |
    del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)
  ')
  
  NEW_REVISION=$(aws ecs register-task-definition --cli-input-json "$NEW_TASK_DEF" --query 'taskDefinition.revision' --output text)
  
  echo "Registered new task definition revision: ${NEW_REVISION}"
  
  aws ecs update-service \
    --cluster "${CLUSTER}" \
    --service "${APP_NAME}-${SERVICE}" \
    --task-definition "${TASK_FAMILY}:${NEW_REVISION}" \
    --force-new-deployment \
    --output json > /dev/null
  
  echo "Service ${SERVICE} updated successfully"
done

echo "All services updated to commit ${COMMIT_SHA}"

