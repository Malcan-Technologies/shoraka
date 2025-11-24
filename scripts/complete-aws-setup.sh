#!/bin/bash
# Complete AWS infrastructure setup for CashSouk
# This script sets up everything needed for ECS deployment

set -e

AWS_REGION=${AWS_REGION:-ap-southeast-5}
GITHUB_REPO=${1:-""}

echo "================================================"
echo "CashSouk Complete AWS Infrastructure Setup"
echo "================================================"
echo ""

if [ -z "$GITHUB_REPO" ]; then
  echo "Usage: ./scripts/complete-aws-setup.sh YOUR_GITHUB_USERNAME/Shoraka"
  echo ""
  echo "Example: ./scripts/complete-aws-setup.sh ivan/Shoraka"
  exit 1
fi

# Check if AWS CLI is configured
echo "Checking AWS CLI configuration..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
  echo "❌ AWS CLI is not configured!"
  echo ""
  echo "Please run: aws configure"
  echo ""
  echo "You'll need:"
  echo "  - AWS Access Key ID"
  echo "  - AWS Secret Access Key"
  echo "  - Default region: ap-southeast-5"
  exit 1
fi

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
echo "✓ AWS Account ID: $AWS_ACCOUNT_ID"
echo "✓ Region: $AWS_REGION"
echo ""

# ===========================================
# STEP 1: Create ECS Task Execution Role
# ===========================================
echo "Step 1/7: Creating ECS Task Execution Role..."

cat > /tmp/ecs-task-execution-trust.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

if aws iam get-role --role-name ecsTaskExecutionRole > /dev/null 2>&1; then
  echo "  ✓ ecsTaskExecutionRole already exists"
else
  aws iam create-role \
    --role-name ecsTaskExecutionRole \
    --assume-role-policy-document file:///tmp/ecs-task-execution-trust.json > /dev/null
  echo "  ✓ Created ecsTaskExecutionRole"
fi

# Attach managed policies
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy 2>/dev/null || true

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess 2>/dev/null || true

echo "  ✓ Attached managed policies"
echo ""

# ===========================================
# STEP 2: Create ECS Task Role
# ===========================================
echo "Step 2/7: Creating ECS Task Role (for application permissions)..."

cat > /tmp/ecs-task-trust.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

if aws iam get-role --role-name ecsTaskRole > /dev/null 2>&1; then
  echo "  ✓ ecsTaskRole already exists"
else
  aws iam create-role \
    --role-name ecsTaskRole \
    --assume-role-policy-document file:///tmp/ecs-task-trust.json > /dev/null
  echo "  ✓ Created ecsTaskRole"
fi

# Create application permissions policy
cat > /tmp/ecs-task-permissions.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::cashsouk-*",
        "arn:aws:s3:::cashsouk-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminUpdateUserAttributes",
        "cognito-idp:AdminGetUser",
        "cognito-idp:ListUsers"
      ],
      "Resource": "arn:aws:cognito-idp:${AWS_REGION}:${AWS_ACCOUNT_ID}:userpool/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter/cashsouk/*"
    }
  ]
}
EOF

if aws iam get-policy --policy-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/CashSoukECSTaskPolicy" > /dev/null 2>&1; then
  echo "  ✓ CashSoukECSTaskPolicy already exists"
else
  aws iam create-policy \
    --policy-name CashSoukECSTaskPolicy \
    --policy-document file:///tmp/ecs-task-permissions.json > /dev/null
  echo "  ✓ Created CashSoukECSTaskPolicy"
fi

aws iam attach-role-policy \
  --role-name ecsTaskRole \
  --policy-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/CashSoukECSTaskPolicy" 2>/dev/null || true

echo "  ✓ Attached application permissions"
echo ""

# ===========================================
# STEP 3: Create ECR Repositories
# ===========================================
echo "Step 3/7: Creating ECR repositories..."
for repo in api landing investor issuer admin; do
  if aws ecr describe-repositories --repository-names cashsouk-$repo --region $AWS_REGION > /dev/null 2>&1; then
    echo "  ✓ cashsouk-$repo already exists"
  else
    aws ecr create-repository \
      --repository-name cashsouk-$repo \
      --region $AWS_REGION \
      --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256 > /dev/null
    echo "  ✓ Created cashsouk-$repo"
  fi
done
echo ""

# ===========================================
# STEP 4: Create GitHub OIDC Provider
# ===========================================
echo "Step 4/7: Setting up GitHub OIDC provider..."
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" > /dev/null 2>&1; then
  echo "  ✓ OIDC provider already exists"
else
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 > /dev/null
  echo "  ✓ Created OIDC provider"
fi
echo ""

# ===========================================
# STEP 5: Create GitHub Actions Deploy Role
# ===========================================
echo "Step 5/7: Creating IAM role for GitHub Actions..."

cat > /tmp/github-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:ref:refs/heads/main"
        }
      }
    }
  ]
}
EOF

if aws iam get-role --role-name GitHubActionsDeployRole > /dev/null 2>&1; then
  echo "  ✓ GitHubActionsDeployRole already exists"
else
  aws iam create-role \
    --role-name GitHubActionsDeployRole \
    --assume-role-policy-document file:///tmp/github-trust-policy.json > /dev/null
  echo "  ✓ Created GitHubActionsDeployRole"
fi

cat > /tmp/github-permissions.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:RunTask",
        "ecs:DescribeTasks"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
        "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskRole"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "*"
    }
  ]
}
EOF

if aws iam get-policy --policy-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/GitHubActionsDeployPolicy" > /dev/null 2>&1; then
  echo "  ✓ GitHubActionsDeployPolicy already exists"
else
  aws iam create-policy \
    --policy-name GitHubActionsDeployPolicy \
    --policy-document file:///tmp/github-permissions.json > /dev/null
  echo "  ✓ Created GitHubActionsDeployPolicy"
fi

aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/GitHubActionsDeployPolicy" 2>/dev/null || true

echo "  ✓ Attached deploy permissions"
echo ""

# ===========================================
# STEP 6: Create ECS Cluster
# ===========================================
echo "Step 6/7: Creating ECS cluster..."
if aws ecs describe-clusters --clusters cashsouk-prod --region $AWS_REGION --query 'clusters[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "  ✓ ECS cluster 'cashsouk-prod' already exists"
else
  aws ecs create-cluster \
    --cluster-name cashsouk-prod \
    --region $AWS_REGION \
    --capacity-providers FARGATE FARGATE_SPOT \
    --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 > /dev/null
  echo "  ✓ Created ECS cluster 'cashsouk-prod'"
fi
echo ""

# ===========================================
# STEP 7: Create CloudWatch Log Groups
# ===========================================
echo "Step 7/7: Creating CloudWatch Log Groups..."
for service in api landing investor issuer admin migrations; do
  if aws logs describe-log-groups --log-group-name-prefix "/aws/ecs/cashsouk-$service" --region $AWS_REGION --query 'logGroups[0]' > /dev/null 2>&1; then
    echo "  ✓ Log group for cashsouk-$service already exists"
  else
    aws logs create-log-group \
      --log-group-name "/aws/ecs/cashsouk-$service" \
      --region $AWS_REGION > /dev/null 2>&1 || true
    aws logs put-retention-policy \
      --log-group-name "/aws/ecs/cashsouk-$service" \
      --retention-in-days 30 \
      --region $AWS_REGION > /dev/null 2>&1 || true
    echo "  ✓ Created log group for cashsouk-$service"
  fi
done
echo ""

# ===========================================
# Cleanup
# ===========================================
rm -f /tmp/ecs-task-execution-trust.json /tmp/ecs-task-trust.json /tmp/ecs-task-permissions.json /tmp/github-trust-policy.json /tmp/github-permissions.json

# ===========================================
# Summary
# ===========================================
echo "================================================"
echo "✅ AWS Infrastructure Setup Complete!"
echo "================================================"
echo ""
echo "Resources created:"
echo "  ✓ IAM Role: ecsTaskExecutionRole (for ECS to pull images & logs)"
echo "  ✓ IAM Role: ecsTaskRole (for app to access S3, Cognito, SSM)"
echo "  ✓ IAM Role: GitHubActionsDeployRole (for CI/CD)"
echo "  ✓ ECR Repositories: 5 (api, landing, investor, issuer, admin)"
echo "  ✓ ECS Cluster: cashsouk-prod"
echo "  ✓ CloudWatch Log Groups: 6"
echo "  ✓ GitHub OIDC Provider"
echo ""
echo "================================================"
echo "🔧 Next Steps"
echo "================================================"
echo ""
echo "1️⃣  Add GitHub Secret:"
echo "    Name:  AWS_DEPLOY_ROLE_ARN"
echo "    Value: arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole"
echo ""
echo "2️⃣  Set up VPC and networking:"
echo "    You need: VPC, subnets, security groups"
echo "    See: docs/deployment/github-actions-setup.md (Step 4)"
echo ""
echo "3️⃣  After VPC setup, add these GitHub secrets:"
echo "    - PRIVATE_SUBNET_1"
echo "    - PRIVATE_SUBNET_2"
echo "    - ECS_SECURITY_GROUP"
echo ""
echo "4️⃣  Build and push initial images:"
echo "    ./scripts/build-all.sh"
echo "    ./scripts/push-to-ecr.sh"
echo ""
echo "5️⃣  Create ECS task definitions and services:"
echo "    See: DEPLOYMENT_QUICKSTART.md (Step 5)"
echo ""
echo "6️⃣  Push to GitHub to trigger deployment:"
echo "    git push origin main"
echo ""
echo "================================================"
echo ""
echo "ECR Registry: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
echo ""

