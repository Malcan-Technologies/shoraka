#!/bin/bash
# Database migration script for CashSouk P2P platform
# Runs Prisma migrations either locally or in AWS ECS

set -e

ENVIRONMENT=${1:-local}

case $ENVIRONMENT in
  local)
    echo "Running migrations locally..."
    cd apps/api
    npx prisma migrate deploy
    echo "✓ Local migrations completed"
    ;;
    
  production|prod)
    echo "Running migrations in AWS ECS (production)..."
    
    # Check required environment variables
    if [ -z "$AWS_REGION" ]; then
      export AWS_REGION=ap-southeast-5
    fi
    
    if [ -z "$ECS_CLUSTER" ]; then
      export ECS_CLUSTER=cashsouk-prod
    fi
    
    # Check if AWS CLI is configured
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
      echo "Error: AWS CLI not configured. Run 'aws configure' first."
      exit 1
    fi
    
    echo "Cluster: $ECS_CLUSTER"
    echo "Region: $AWS_REGION"
    
    # Run migration task
    TASK_ARN=$(aws ecs run-task \
      --cluster $ECS_CLUSTER \
      --task-definition cashsouk-migrations \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_IDS],securityGroups=[$ECS_SECURITY_GROUP],assignPublicIp=DISABLED}" \
      --region $AWS_REGION \
      --query 'tasks[0].taskArn' \
      --output text)
    
    if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
      echo "Error: Failed to start migration task"
      exit 1
    fi
    
    echo "Migration task started: $TASK_ARN"
    echo "Waiting for task to complete..."
    
    # Wait for task to stop
    aws ecs wait tasks-stopped \
      --cluster $ECS_CLUSTER \
      --tasks $TASK_ARN \
      --region $AWS_REGION
    
    # Check exit code
    EXIT_CODE=$(aws ecs describe-tasks \
      --cluster $ECS_CLUSTER \
      --tasks $TASK_ARN \
      --region $AWS_REGION \
      --query 'tasks[0].containers[0].exitCode' \
      --output text)
    
    if [ "$EXIT_CODE" != "0" ]; then
      echo "✗ Migration failed with exit code $EXIT_CODE"
      echo "Check logs: aws logs tail /ecs/cashsouk-migrations --follow --region $AWS_REGION"
      exit 1
    fi
    
    echo "✓ Production migrations completed successfully"
    ;;
    
  *)
    echo "Usage: $0 [local|production]"
    echo ""
    echo "Examples:"
    echo "  $0              # Run locally (default)"
    echo "  $0 local        # Run locally"
    echo "  $0 production   # Run in AWS ECS"
    echo ""
    echo "Environment variables for production:"
    echo "  AWS_REGION (default: ap-southeast-5)"
    echo "  ECS_CLUSTER (default: cashsouk-prod)"
    echo "  PRIVATE_SUBNET_IDS (required)"
    echo "  ECS_SECURITY_GROUP (required)"
    exit 1
    ;;
esac

