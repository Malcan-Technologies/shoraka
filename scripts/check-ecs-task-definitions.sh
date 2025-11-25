#!/bin/bash
# Check ECS task definitions to verify role ARNs

echo "🔍 Checking ECS Task Definitions..."
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
  echo "❌ AWS CLI not configured. Please run this in AWS CloudShell or configure AWS CLI locally."
  exit 1
fi

REGION="ap-southeast-5"

# Function to check task definition
check_task_def() {
  local task_family=$1
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 Task Definition: $task_family"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if aws ecs describe-task-definition --task-definition "$task_family" --region "$REGION" &>/dev/null; then
    echo "✅ Task definition exists"
    echo ""
    
    echo "Execution Role ARN:"
    aws ecs describe-task-definition \
      --task-definition "$task_family" \
      --region "$REGION" \
      --query 'taskDefinition.executionRoleArn' \
      --output text
    
    echo ""
    echo "Task Role ARN:"
    aws ecs describe-task-definition \
      --task-definition "$task_family" \
      --region "$REGION" \
      --query 'taskDefinition.taskRoleArn' \
      --output text
    
    echo ""
    echo "Latest Revision:"
    aws ecs describe-task-definition \
      --task-definition "$task_family" \
      --region "$REGION" \
      --query 'taskDefinition.revision' \
      --output text
    
    echo ""
    echo "Image:"
    aws ecs describe-task-definition \
      --task-definition "$task_family" \
      --region "$REGION" \
      --query 'taskDefinition.containerDefinitions[0].image' \
      --output text
  else
    echo "❌ Task definition does NOT exist"
  fi
  
  echo ""
}

# Check all task definitions
check_task_def "cashsouk-migrate"
check_task_def "cashsouk-api"
check_task_def "cashsouk-landing"
check_task_def "cashsouk-investor"
check_task_def "cashsouk-issuer"
check_task_def "cashsouk-admin"

echo ""
echo "✅ Check complete!"

