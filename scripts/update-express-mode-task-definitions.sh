#!/bin/bash

set -e

echo "🔧 Updating Express mode ECS task definitions with DATABASE_URL secret..."
echo ""

REGION="ap-southeast-5"
SECRET_ARN="arn:aws:secretsmanager:ap-southeast-5:652821469470:secret:cashsouk/database-url"

# Task definition to update
TASK_DEF_NAME="default-api-cashsouk-09ff"

echo "📋 Fetching current task definition: $TASK_DEF_NAME..."

# Get the current task definition
TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition "$TASK_DEF_NAME" \
  --region "$REGION")

echo "✅ Current task definition retrieved"
echo ""

# Extract the task definition and add/update the DATABASE_URL secret
echo "🔧 Adding DATABASE_URL secret to task definition..."

NEW_TASK_DEF=$(echo "$TASK_DEF" | jq --arg SECRET_ARN "$SECRET_ARN" '
  .taskDefinition |
  # Remove read-only fields
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy) |
  # Add or update the DATABASE_URL secret
  .containerDefinitions[0].secrets = [
    {
      "name": "DATABASE_URL",
      "valueFrom": $SECRET_ARN
    }
  ]
')

echo "✅ Secret added to task definition"
echo ""

# Register the new task definition revision
echo "📦 Registering new task definition revision..."

NEW_REVISION=$(aws ecs register-task-definition \
  --cli-input-json "$NEW_TASK_DEF" \
  --region "$REGION" \
  --query 'taskDefinition.revision' \
  --output text)

echo "✅ New task definition revision registered: $NEW_REVISION"
echo ""

# Update the service to use the new task definition
echo "🚀 Updating ECS service to use new task definition..."

SERVICE_NAME="api-cashsouk-09ff"

aws ecs update-service \
  --cluster default \
  --service "$SERVICE_NAME" \
  --task-definition "$TASK_DEF_NAME" \
  --force-new-deployment \
  --region "$REGION" > /dev/null

echo "✅ Service updated successfully!"
echo ""
echo "🎉 Done! The API service will restart with the DATABASE_URL secret."
echo ""
echo "📊 Monitor deployment:"
echo "   aws ecs describe-services --cluster default --service $SERVICE_NAME --region $REGION"
echo ""

