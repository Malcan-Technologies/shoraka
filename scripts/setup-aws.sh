#!/bin/bash
# AWS infrastructure setup helper script
# Creates ECR repositories and verifies AWS configuration

set -e

AWS_REGION=${AWS_REGION:-ap-southeast-5}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

echo "================================================"
echo "CashSouk AWS Setup Helper"
echo "================================================"
echo "Account ID: $AWS_ACCOUNT_ID"
echo "Region: $AWS_REGION"
echo ""

# Function to create ECR repository
create_ecr_repo() {
  local repo_name=$1
  
  echo "Creating ECR repository: $repo_name"
  
  if aws ecr describe-repositories --repository-names $repo_name --region $AWS_REGION > /dev/null 2>&1; then
    echo "  ✓ Repository $repo_name already exists"
  else
    aws ecr create-repository \
      --repository-name $repo_name \
      --region $AWS_REGION \
      --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256 \
      --tags Key=Project,Value=CashSouk Key=Environment,Value=Production \
      > /dev/null
    
    echo "  ✓ Created repository $repo_name"
    
    # Set lifecycle policy (keep last 10 images)
    aws ecr put-lifecycle-policy \
      --repository-name $repo_name \
      --region $AWS_REGION \
      --lifecycle-policy-text '{
        "rules": [{
          "rulePriority": 1,
          "description": "Keep last 10 images",
          "selection": {
            "tagStatus": "any",
            "countType": "imageCountMoreThan",
            "countNumber": 10
          },
          "action": {
            "type": "expire"
          }
        }]
      }' > /dev/null
    
    echo "  ✓ Set lifecycle policy for $repo_name"
  fi
}

# Create ECR repositories
echo "Step 1: Creating ECR Repositories"
echo "-----------------------------------"
create_ecr_repo "cashsouk-landing"
create_ecr_repo "cashsouk-investor"
create_ecr_repo "cashsouk-issuer"
create_ecr_repo "cashsouk-admin"
create_ecr_repo "cashsouk-api"
echo ""

# Verify AWS configuration
echo "Step 2: Verifying AWS Configuration"
echo "-----------------------------------"

# Check if ECS cluster exists
if aws ecs describe-clusters --clusters cashsouk-prod --region $AWS_REGION --query 'clusters[0].status' --output text 2>/dev/null | grep -q "ACTIVE"; then
  echo "  ✓ ECS cluster 'cashsouk-prod' exists and is active"
else
  echo "  ✗ ECS cluster 'cashsouk-prod' not found"
  echo "    Create it with: aws ecs create-cluster --cluster-name cashsouk-prod --region $AWS_REGION"
fi

# Check if CloudWatch log groups exist
echo ""
echo "Step 3: Creating CloudWatch Log Groups"
echo "-----------------------------------"

for service in landing investor issuer admin api migrations; do
  log_group="/ecs/cashsouk-$service"
  
  if aws logs describe-log-groups --log-group-name-prefix $log_group --region $AWS_REGION --query "logGroups[?logGroupName=='$log_group']" --output text 2>/dev/null | grep -q $log_group; then
    echo "  ✓ Log group $log_group exists"
  else
    aws logs create-log-group --log-group-name $log_group --region $AWS_REGION
    aws logs put-retention-policy --log-group-name $log_group --retention-in-days 30 --region $AWS_REGION
    echo "  ✓ Created log group $log_group"
  fi
done

echo ""
echo "Step 4: Summary"
echo "-----------------------------------"
echo "ECR Registry URL: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
echo ""
echo "Next steps:"
echo "1. Set up VPC and networking (see infra/README.md)"
echo "2. Create ALB and target groups"
echo "3. Set up RDS PostgreSQL"
echo "4. Configure Cognito User Pool"
echo "5. Create S3 buckets"
echo "6. Set up SSM/Secrets Manager parameters"
echo "7. Register ECS task definitions"
echo "8. Create ECS services"
echo "9. Configure GitHub OIDC and secrets"
echo ""
echo "For detailed instructions, see: infra/README.md"
echo "================================================"

