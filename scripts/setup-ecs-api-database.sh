#!/bin/bash
set -e

# Setup ECS API to connect to RDS via Proxy
echo "🚀 Configuring ECS API to connect to RDS..."

AWS_REGION="ap-southeast-5"
ACCOUNT_ID="652821469470"

# RDS Proxy endpoint
PROXY_ENDPOINT="cashsouk-prod-proxy.proxy-c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com"

echo "📋 Configuration:"
echo "  RDS Proxy: $PROXY_ENDPOINT"
echo "  Secrets ARN: arn:aws:secretsmanager:$AWS_REGION:$ACCOUNT_ID:secret:rds!db-71798d0b-adc4-4acb-a5e7-0a3275e77182-ggp48I"
echo ""

# 1. Update the secret to include the proxy endpoint
echo "🔐 Updating secret with RDS Proxy endpoint..."

# Get current secret value
CURRENT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id rds!db-71798d0b-adc4-4acb-a5e7-0a3275e77182 \
  --region $AWS_REGION \
  --query SecretString \
  --output text 2>/dev/null || echo "{}")

if [ "$CURRENT_SECRET" = "{}" ]; then
  echo "❌ Could not retrieve secret. Please configure AWS CLI first."
  echo "Run: aws configure"
  exit 1
fi

# Parse and update the secret to use proxy endpoint
UPDATED_SECRET=$(echo "$CURRENT_SECRET" | jq --arg host "$PROXY_ENDPOINT" '. + {host: $host}')

aws secretsmanager update-secret \
  --secret-id rds!db-71798d0b-adc4-4acb-a5e7-0a3275e77182 \
  --secret-string "$UPDATED_SECRET" \
  --region $AWS_REGION

echo "✅ Secret updated with proxy endpoint"

# 2. Create CloudWatch log group for API
echo "📋 Creating CloudWatch log group..."
aws logs create-log-group \
  --log-group-name /ecs/cashsouk-api \
  --region $AWS_REGION \
  2>/dev/null || echo "Log group already exists"

aws logs put-retention-policy \
  --log-group-name /ecs/cashsouk-api \
  --retention-in-days 30 \
  --region $AWS_REGION

# 3. Ensure IAM roles have correct permissions
echo "🔐 Updating IAM permissions..."

# Task Execution Role - needs to read secrets
EXECUTION_ROLE_NAME="ecsTaskExecutionRole"

aws iam put-role-policy \
  --role-name $EXECUTION_ROLE_NAME \
  --policy-name SecretsManagerAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:'$AWS_REGION':'$ACCOUNT_ID':secret:rds!db-71798d0b-adc4-4acb-a5e7-0a3275e77182-*"
      ]
    }]
  }' 2>/dev/null || echo "Policy already exists"

# 4. Register/Update ECS task definition
echo "📝 Registering ECS task definition..."
TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://$(dirname "$0")/../infra/ecs-task-definition-api.json \
  --region $AWS_REGION \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "✅ Task definition registered: $TASK_DEF_ARN"

# 5. Update ECS service (if it exists)
SERVICE_NAME="api-cashsouk-09ff"

if aws ecs describe-services \
  --cluster default \
  --services $SERVICE_NAME \
  --region $AWS_REGION \
  --query 'services[0].serviceName' \
  --output text 2>/dev/null | grep -q "$SERVICE_NAME"; then
  
  echo "🔄 Updating ECS service with new task definition..."
  aws ecs update-service \
    --cluster default \
    --service $SERVICE_NAME \
    --task-definition cashsouk-api \
    --force-new-deployment \
    --region $AWS_REGION \
    --query 'service.serviceName' \
    --output text
  
  echo "✅ Service updated and redeploying..."
  echo ""
  echo "⏳ Waiting for deployment to stabilize (this may take a few minutes)..."
  aws ecs wait services-stable \
    --cluster default \
    --services $SERVICE_NAME \
    --region $AWS_REGION
  
  echo "✅ Deployment complete!"
else
  echo "⚠️  Service $SERVICE_NAME not found. Please create it manually or via GitHub Actions."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ECS API Database Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Configuration:"
echo "  • RDS Proxy: $PROXY_ENDPOINT"
echo "  • Database: cashsouk"
echo "  • Connection: Via AWS Secrets Manager"
echo ""
echo "🧪 Test the connection:"
echo "  1. Get API endpoint from ECS service or ALB"
echo "  2. curl https://your-api-endpoint/healthz"
echo ""
echo "📊 View logs:"
echo "  aws logs tail /ecs/cashsouk-api --follow --region $AWS_REGION"
echo ""

