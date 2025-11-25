#!/bin/bash

# Create CloudWatch Log Groups for ECS services
# Run this if you see "error while retrieving logs from log group" errors

REGION="ap-southeast-5"
RETENTION_DAYS=7

LOG_GROUPS=(
  "/ecs/cashsouk-admin"
  "/ecs/cashsouk-api"
  "/ecs/cashsouk-investor"
  "/ecs/cashsouk-issuer"
  "/ecs/cashsouk-landing"
)

echo "Creating CloudWatch Log Groups..."

for LOG_GROUP in "${LOG_GROUPS[@]}"; do
  echo "📝 Creating log group: $LOG_GROUP"
  
  aws logs create-log-group \
    --log-group-name "$LOG_GROUP" \
    --region "$REGION" 2>/dev/null || echo "  ℹ️  Log group already exists"
  
  echo "⏰ Setting retention policy to $RETENTION_DAYS days"
  aws logs put-retention-policy \
    --log-group-name "$LOG_GROUP" \
    --retention-in-days "$RETENTION_DAYS" \
    --region "$REGION"
  
  echo "✅ $LOG_GROUP configured"
  echo ""
done

echo "🎉 All log groups created/updated!"
echo ""
echo "Verify with:"
echo "aws logs describe-log-groups --log-group-name-prefix /ecs/ --region $REGION"

