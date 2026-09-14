#!/bin/bash
set -euo pipefail

# Updates the API ECS task definition's DATABASE_URL only.
# Runtime (API) uses cashsouk/app-database-url (app role).
# Migrations keep cashsouk/database-url (admin role) and are not modified.

echo "Updating API ECS task definition DATABASE_URL secret (app role)..."
echo ""

REGION="ap-southeast-5"
API_TASK_DEF_NAME="default-api-cashsouk-09ff"
MIGRATE_TASK_DEF_NAME="cashsouk-migrate"
APP_SECRET_NAME="cashsouk/app-database-url"
MIGRATE_SECRET_NAME="cashsouk/database-url"
SERVICE_NAME="api-cashsouk-09ff"

APP_SECRET_ARN=$(aws secretsmanager describe-secret \
  --secret-id "$APP_SECRET_NAME" \
  --region "$REGION" \
  --query ARN \
  --output text)
MIGRATE_SECRET_ARN=$(aws secretsmanager describe-secret \
  --secret-id "$MIGRATE_SECRET_NAME" \
  --region "$REGION" \
  --query ARN \
  --output text)

if [ "$APP_SECRET_NAME" = "$MIGRATE_SECRET_NAME" ] || [ "$APP_SECRET_ARN" = "$MIGRATE_SECRET_ARN" ]; then
  echo "API and migrate DATABASE_URL secrets must differ."
  exit 1
fi

echo "Fetching current task definition: $API_TASK_DEF_NAME..."

TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition "$API_TASK_DEF_NAME" \
  --region "$REGION")

echo "Current API task definition retrieved"
echo ""

if echo "$TASK_DEF" | jq -e --arg FAMILY "$MIGRATE_TASK_DEF_NAME" '.taskDefinition.family == $FAMILY' >/dev/null; then
  echo "Refusing to modify the migrate task definition. Migrations must keep $MIGRATE_SECRET_ARN"
  exit 1
fi

echo "Setting API DATABASE_URL to app secret (preserving other secrets)..."

NEW_TASK_DEF=$(echo "$TASK_DEF" | jq --arg SECRET_ARN "$APP_SECRET_ARN" --arg MIGRATE_SECRET_ARN "$MIGRATE_SECRET_ARN" '
  .taskDefinition |
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy) |
  .containerDefinitions[0].secrets = (
    ((.containerDefinitions[0].secrets // []) | map(select(.name != "DATABASE_URL")))
    + [{ "name": "DATABASE_URL", "valueFrom": $SECRET_ARN }]
  ) |
  (.containerDefinitions[0].secrets | map(select(.name == "DATABASE_URL")) | .[0].valueFrom) as $dbUrl |
  if $dbUrl != $SECRET_ARN or $dbUrl == $MIGRATE_SECRET_ARN then
    error("API DATABASE_URL must reference cashsouk/app-database-url; cashsouk/database-url is reserved for the migrate task")
  else
    .
  end
')

echo "Secret merged into API task definition"
echo ""

echo "Registering new task definition revision..."

NEW_REVISION=$(aws ecs register-task-definition \
  --cli-input-json "$NEW_TASK_DEF" \
  --region "$REGION" \
  --query 'taskDefinition.revision' \
  --output text)

echo "New API task definition revision registered: $NEW_REVISION"
echo ""

echo "Updating ECS service to use new task definition..."

aws ecs update-service \
  --cluster default \
  --service "$SERVICE_NAME" \
  --task-definition "$API_TASK_DEF_NAME" \
  --force-new-deployment \
  --region "$REGION" > /dev/null

echo "API service updated. Migrate task $MIGRATE_TASK_DEF_NAME was not changed and must remain on $MIGRATE_SECRET_ARN"
echo ""
echo "Monitor deployment:"
echo "   aws ecs describe-services --cluster default --service $SERVICE_NAME --region $REGION"
echo ""
