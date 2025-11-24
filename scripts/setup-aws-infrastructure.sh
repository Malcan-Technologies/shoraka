#!/bin/bash
# Quick setup script for AWS infrastructure
# This script helps you set up the basic AWS infrastructure for CashSouk

set -e

AWS_REGION=${AWS_REGION:-ap-southeast-5}
GITHUB_REPO=${1:-""}

echo "================================================"
echo "CashSouk AWS Infrastructure Setup"
echo "================================================"
echo ""

if [ -z "$GITHUB_REPO" ]; then
  echo "Usage: ./scripts/setup-aws-infrastructure.sh YOUR_GITHUB_USERNAME/Shoraka"
  echo ""
  echo "Example: ./scripts/setup-aws-infrastructure.sh ivan/Shoraka"
  exit 1
fi

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
echo "✓ AWS Account ID: $AWS_ACCOUNT_ID"
echo ""

# Step 1: Create ECR Repositories
echo "Step 1/5: Creating ECR repositories..."
for repo in api landing investor issuer admin; do
  if aws ecr describe-repositories --repository-names cashsouk-$repo --region $AWS_REGION > /dev/null 2>&1; then
    echo "  ✓ cashsouk-$repo already exists"
  else
    aws ecr create-repository --repository-name cashsouk-$repo --region $AWS_REGION > /dev/null
    echo "  ✓ Created cashsouk-$repo"
  fi
done
echo ""

# Step 2: Create OIDC Provider
echo "Step 2/5: Setting up GitHub OIDC provider..."
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

# Step 3: Create IAM Role for GitHub Actions
echo "Step 3/5: Creating IAM role for GitHub Actions..."

# Create trust policy
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

# Create permission policy
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
        "ecs:*"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
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

# Attach policy to role
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/GitHubActionsDeployPolicy" 2>/dev/null || echo "  ✓ Policy already attached"

echo ""

# Step 4: Create ECS Cluster
echo "Step 4/5: Creating ECS cluster..."
if aws ecs describe-clusters --clusters cashsouk-prod --region $AWS_REGION --query 'clusters[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "  ✓ ECS cluster 'cashsouk-prod' already exists"
else
  aws ecs create-cluster --cluster-name cashsouk-prod --region $AWS_REGION > /dev/null
  echo "  ✓ Created ECS cluster 'cashsouk-prod'"
fi
echo ""

# Step 5: Display Summary
echo "Step 5/5: Setup complete!"
echo ""
echo "================================================"
echo "📋 Summary"
echo "================================================"
echo ""
echo "✅ ECR Repositories created in region: $AWS_REGION"
echo "✅ GitHub OIDC provider configured"
echo "✅ IAM role created: GitHubActionsDeployRole"
echo "✅ ECS Cluster created: cashsouk-prod"
echo ""
echo "================================================"
echo "🔧 Next Steps"
echo "================================================"
echo ""
echo "1. Add the following secret to your GitHub repository:"
echo "   Name:  AWS_DEPLOY_ROLE_ARN"
echo "   Value: arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole"
echo ""
echo "2. Set up VPC, Subnets, and Security Groups:"
echo "   See: docs/deployment/github-actions-setup.md (Step 4)"
echo ""
echo "3. Add these GitHub secrets (from Step 2):"
echo "   - PRIVATE_SUBNET_1"
echo "   - PRIVATE_SUBNET_2"
echo "   - ECS_SECURITY_GROUP"
echo ""
echo "4. Build and push initial Docker images:"
echo "   ./scripts/build-all.sh"
echo "   ./scripts/push-to-ecr.sh"
echo ""
echo "5. Create ECS task definitions and services:"
echo "   See: docs/deployment/github-actions-setup.md (Step 6-7)"
echo ""
echo "6. Push to GitHub to trigger deployment:"
echo "   git push origin main"
echo ""
echo "================================================"

# Cleanup temp files
rm -f /tmp/github-trust-policy.json /tmp/github-permissions.json

echo ""
echo "For detailed instructions, see: docs/deployment/github-actions-setup.md"
echo ""

