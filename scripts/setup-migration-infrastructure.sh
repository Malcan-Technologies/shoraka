#!/bin/bash
set -e

# Setup Migration Infrastructure in AWS
# This script creates the necessary AWS resources for running database migrations

echo "🚀 Setting up migration infrastructure in AWS..."

AWS_REGION="ap-southeast-5"
ACCOUNT_ID="652821469470"

# 1. Create ECR repository for migration image
echo "📦 Creating ECR repository for migrations..."
aws ecr create-repository \
  --repository-name cashsouk-migrate \
  --region $AWS_REGION \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  2>/dev/null || echo "Repository already exists"

# 2. Create CloudWatch log group
echo "📋 Creating CloudWatch log group..."
aws logs create-log-group \
  --log-group-name /ecs/cashsouk-migrate \
  --region $AWS_REGION \
  2>/dev/null || echo "Log group already exists"

aws logs put-retention-policy \
  --log-group-name /ecs/cashsouk-migrate \
  --retention-in-days 30 \
  --region $AWS_REGION

# 3. Register ECS task definition
echo "📝 Registering ECS task definition..."
aws ecs register-task-definition \
  --cli-input-json file://$(dirname "$0")/../infra/ecs-task-definition-migrate.json \
  --region $AWS_REGION

# 4. Update IAM task role permissions
echo "🔐 Updating IAM permissions..."

# Get or create task execution role
EXECUTION_ROLE_NAME="ecsTaskExecutionRole"
TASK_ROLE_NAME="ecsTaskRole"

# Ensure task execution role exists (for pulling from Secrets Manager)
aws iam get-role --role-name $EXECUTION_ROLE_NAME >/dev/null 2>&1 || \
  aws iam create-role \
    --role-name $EXECUTION_ROLE_NAME \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "ecs-tasks.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }'

# Attach AWS managed policy for ECS task execution
aws iam attach-role-policy \
  --role-name $EXECUTION_ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Add Secrets Manager permissions to execution role
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
        "arn:aws:secretsmanager:'$AWS_REGION':'$ACCOUNT_ID':secret:prod/cashsouk/db-*",
        "arn:aws:secretsmanager:'$AWS_REGION':'$ACCOUNT_ID':secret:rds!db-71798d0b-adc4-4acb-a5e7-0a3275e77182-*"
      ]
    }]
  }'

# Ensure task role exists (for application permissions)
aws iam get-role --role-name $TASK_ROLE_NAME >/dev/null 2>&1 || \
  aws iam create-role \
    --role-name $TASK_ROLE_NAME \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "ecs-tasks.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }'

echo "✅ Migration infrastructure setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Summary:"
echo "  • ECR Repository: cashsouk-migrate"
echo "  • Log Group: /ecs/cashsouk-migrate"
echo "  • Task Definition: cashsouk-migrate"
echo ""
echo "📝 Next steps:"
echo "  1. Build and push migration image:"
echo "     docker build -f docker/migrate.Dockerfile -t $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/cashsouk-migrate:latest ."
echo "     aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
echo "     docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/cashsouk-migrate:latest"
echo ""
echo "  2. Test migration manually:"
echo "     ./scripts/test-migration.sh"
echo ""
echo "  3. GitHub Actions will now automatically run migrations before API deployments"
echo ""

