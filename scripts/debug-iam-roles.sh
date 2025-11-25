#!/bin/bash
# Debug script to check IAM role configurations for ECS deployment

set -e

echo "🔍 Checking IAM Role Configurations..."
echo ""

# Check ecsTaskExecutionRole
echo "1️⃣ Checking ecsTaskExecutionRole..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if aws iam get-role --role-name ecsTaskExecutionRole &>/dev/null; then
  echo "✅ ecsTaskExecutionRole exists"
  
  echo ""
  echo "Trust Policy:"
  aws iam get-role --role-name ecsTaskExecutionRole --query 'Role.AssumeRolePolicyDocument' --output json
  
  echo ""
  echo "Attached Policies:"
  aws iam list-attached-role-policies --role-name ecsTaskExecutionRole --query 'AttachedPolicies[*].[PolicyName]' --output table
  
  echo ""
  echo "Inline Policies:"
  aws iam list-role-policies --role-name ecsTaskExecutionRole --query 'PolicyNames' --output table
else
  echo "❌ ecsTaskExecutionRole does NOT exist"
fi

echo ""
echo ""

# Check ecsTaskRole
echo "2️⃣ Checking ecsTaskRole..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if aws iam get-role --role-name ecsTaskRole &>/dev/null; then
  echo "✅ ecsTaskRole exists"
  
  echo ""
  echo "Trust Policy:"
  aws iam get-role --role-name ecsTaskRole --query 'Role.AssumeRolePolicyDocument' --output json
  
  echo ""
  echo "Attached Policies:"
  aws iam list-attached-role-policies --role-name ecsTaskRole --query 'AttachedPolicies[*].[PolicyName]' --output table
  
  echo ""
  echo "Inline Policies:"
  aws iam list-role-policies --role-name ecsTaskRole --query 'PolicyNames' --output table
else
  echo "❌ ecsTaskRole does NOT exist"
fi

echo ""
echo ""

# Check GitHub Actions Role
echo "3️⃣ Checking GitHubActionsECRPushRole..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if aws iam get-role --role-name GitHubActionsECRPushRole &>/dev/null; then
  echo "✅ GitHubActionsECRPushRole exists"
  
  echo ""
  echo "Trust Policy:"
  aws iam get-role --role-name GitHubActionsECRPushRole --query 'Role.AssumeRolePolicyDocument' --output json
  
  echo ""
  echo "Attached Policies:"
  aws iam list-attached-role-policies --role-name GitHubActionsECRPushRole --query 'AttachedPolicies[*].[PolicyName]' --output table
  
  echo ""
  echo "Inline Policies:"
  INLINE_POLICIES=$(aws iam list-role-policies --role-name GitHubActionsECRPushRole --query 'PolicyNames' --output text)
  
  if [ -n "$INLINE_POLICIES" ]; then
    for policy in $INLINE_POLICIES; do
      echo ""
      echo "Inline Policy: $policy"
      aws iam get-role-policy --role-name GitHubActionsECRPushRole --policy-name "$policy" --query 'PolicyDocument' --output json
    done
  else
    echo "No inline policies"
  fi
else
  echo "❌ GitHubActionsECRPushRole does NOT exist"
fi

echo ""
echo ""

# Check migration task definition
echo "4️⃣ Checking Migration Task Definition..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if aws ecs describe-task-definition --task-definition cashsouk-migrate --region ap-southeast-5 &>/dev/null; then
  echo "✅ cashsouk-migrate task definition exists"
  
  echo ""
  echo "Execution Role ARN:"
  aws ecs describe-task-definition --task-definition cashsouk-migrate --region ap-southeast-5 --query 'taskDefinition.executionRoleArn' --output text
  
  echo ""
  echo "Task Role ARN:"
  aws ecs describe-task-definition --task-definition cashsouk-migrate --region ap-southeast-5 --query 'taskDefinition.taskRoleArn' --output text
else
  echo "❌ cashsouk-migrate task definition does NOT exist"
fi

echo ""
echo ""
echo "✅ Diagnostics complete!"

