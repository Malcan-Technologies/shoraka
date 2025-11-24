# GitHub Actions CI/CD Setup Guide

This guide walks you through setting up automated deployment from GitHub to AWS ECS Fargate using OIDC authentication.

## Prerequisites

- AWS Account with appropriate permissions
- GitHub repository
- AWS CLI installed and configured
- Your code pushed to GitHub

## Step 1: Create ECR Repositories

Create a repository for each container image:

```bash
aws ecr create-repository --repository-name cashsouk-api --region ap-southeast-5
aws ecr create-repository --repository-name cashsouk-landing --region ap-southeast-5
aws ecr create-repository --repository-name cashsouk-investor --region ap-southeast-5
aws ecr create-repository --repository-name cashsouk-issuer --region ap-southeast-5
aws ecr create-repository --repository-name cashsouk-admin --region ap-southeast-5
```

## Step 2: Set Up GitHub OIDC Provider in AWS

### 2.1 Create the OIDC Provider

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2.2 Create IAM Role for GitHub Actions

Create a file `github-actions-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/Shoraka:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

**Replace:**
- `YOUR_AWS_ACCOUNT_ID` with your AWS account ID
- `YOUR_GITHUB_USERNAME` with your GitHub username or organization

Create the role:

```bash
aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document file://github-actions-trust-policy.json
```

### 2.3 Create and Attach Permission Policy

Create `github-actions-permissions.json`:

```json
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
        "ecs:WaitUntilServicesStable"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
        "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:role/ecsTaskRole"
      ]
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
```

**Replace `YOUR_AWS_ACCOUNT_ID`** with your AWS account ID.

Create and attach the policy:

```bash
aws iam create-policy \
  --policy-name GitHubActionsDeployPolicy \
  --policy-document file://github-actions-permissions.json

aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::YOUR_AWS_ACCOUNT_ID:policy/GitHubActionsDeployPolicy
```

## Step 3: Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name cashsouk-prod \
  --region ap-southeast-5
```

## Step 4: Set Up VPC and Networking

### 4.1 Create VPC (if you don't have one)

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --region ap-southeast-5 \
  --query 'Vpc.VpcId' \
  --output text)

aws ec2 create-tags \
  --resources $VPC_ID \
  --tags Key=Name,Value=cashsouk-vpc \
  --region ap-southeast-5

# Enable DNS hostnames
aws ec2 modify-vpc-attribute \
  --vpc-id $VPC_ID \
  --enable-dns-hostnames \
  --region ap-southeast-5

# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --region ap-southeast-5 \
  --query 'InternetGateway.InternetGatewayId' \
  --output text)

aws ec2 attach-internet-gateway \
  --vpc-id $VPC_ID \
  --internet-gateway-id $IGW_ID \
  --region ap-southeast-5

# Create Public Subnets
PUBLIC_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ap-southeast-5a \
  --region ap-southeast-5 \
  --query 'Subnet.SubnetId' \
  --output text)

PUBLIC_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ap-southeast-5b \
  --region ap-southeast-5 \
  --query 'Subnet.SubnetId' \
  --output text)

# Create Private Subnets
PRIVATE_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.10.0/24 \
  --availability-zone ap-southeast-5a \
  --region ap-southeast-5 \
  --query 'Subnet.SubnetId' \
  --output text)

PRIVATE_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.11.0/24 \
  --availability-zone ap-southeast-5b \
  --region ap-southeast-5 \
  --query 'Subnet.SubnetId' \
  --output text)

# Create NAT Gateways (for private subnets to access internet)
# First, allocate Elastic IPs
EIP_1=$(aws ec2 allocate-address \
  --domain vpc \
  --region ap-southeast-5 \
  --query 'AllocationId' \
  --output text)

NAT_GW_1=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_1 \
  --allocation-id $EIP_1 \
  --region ap-southeast-5 \
  --query 'NatGateway.NatGatewayId' \
  --output text)

# Create Route Tables
PUBLIC_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --region ap-southeast-5 \
  --query 'RouteTable.RouteTableId' \
  --output text)

PRIVATE_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --region ap-southeast-5 \
  --query 'RouteTable.RouteTableId' \
  --output text)

# Add routes
aws ec2 create-route \
  --route-table-id $PUBLIC_RT \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID \
  --region ap-southeast-5

# Wait for NAT Gateway to be available
aws ec2 wait nat-gateway-available \
  --nat-gateway-ids $NAT_GW_1 \
  --region ap-southeast-5

aws ec2 create-route \
  --route-table-id $PRIVATE_RT \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id $NAT_GW_1 \
  --region ap-southeast-5

# Associate subnets with route tables
aws ec2 associate-route-table \
  --subnet-id $PUBLIC_SUBNET_1 \
  --route-table-id $PUBLIC_RT \
  --region ap-southeast-5

aws ec2 associate-route-table \
  --subnet-id $PUBLIC_SUBNET_2 \
  --route-table-id $PUBLIC_RT \
  --region ap-southeast-5

aws ec2 associate-route-table \
  --subnet-id $PRIVATE_SUBNET_1 \
  --route-table-id $PRIVATE_RT \
  --region ap-southeast-5

aws ec2 associate-route-table \
  --subnet-id $PRIVATE_SUBNET_2 \
  --route-table-id $PRIVATE_RT \
  --region ap-southeast-5

echo "VPC Setup Complete!"
echo "VPC ID: $VPC_ID"
echo "Public Subnets: $PUBLIC_SUBNET_1, $PUBLIC_SUBNET_2"
echo "Private Subnets: $PRIVATE_SUBNET_1, $PRIVATE_SUBNET_2"
```

### 4.2 Create Security Groups

```bash
# Security Group for ALB
ALB_SG=$(aws ec2 create-security-group \
  --group-name cashsouk-alb-sg \
  --description "Security group for CashSouk ALB" \
  --vpc-id $VPC_ID \
  --region ap-southeast-5 \
  --query 'GroupId' \
  --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region ap-southeast-5

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region ap-southeast-5

# Security Group for ECS Tasks
ECS_SG=$(aws ec2 create-security-group \
  --group-name cashsouk-ecs-sg \
  --description "Security group for CashSouk ECS tasks" \
  --vpc-id $VPC_ID \
  --region ap-southeast-5 \
  --query 'GroupId' \
  --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 3000 \
  --source-group $ALB_SG \
  --region ap-southeast-5

aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 4000 \
  --source-group $ALB_SG \
  --region ap-southeast-5

# Security Group for RDS
RDS_SG=$(aws ec2 create-security-group \
  --group-name cashsouk-rds-sg \
  --description "Security group for CashSouk RDS" \
  --vpc-id $VPC_ID \
  --region ap-southeast-5 \
  --query 'GroupId' \
  --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 5432 \
  --source-group $ECS_SG \
  --region ap-southeast-5

echo "Security Groups Created!"
echo "ALB SG: $ALB_SG"
echo "ECS SG: $ECS_SG"
echo "RDS SG: $RDS_SG"
```

## Step 5: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

1. **AWS_DEPLOY_ROLE_ARN**
   - Value: `arn:aws:iam::YOUR_AWS_ACCOUNT_ID:role/GitHubActionsDeployRole`

2. **PRIVATE_SUBNET_1**
   - Value: Your private subnet ID (from Step 4)

3. **PRIVATE_SUBNET_2**
   - Value: Your second private subnet ID (from Step 4)

4. **ECS_SECURITY_GROUP**
   - Value: Your ECS security group ID (from Step 4)

## Step 6: Create Initial ECS Task Definitions

You need to create initial task definitions for each service. Use the files in `infra/ecs/task-def-*.json` as templates.

Update each task definition with your ECR image URIs and execute:

```bash
aws ecs register-task-definition \
  --cli-input-json file://infra/ecs/task-def-api.json \
  --region ap-southeast-5

aws ecs register-task-definition \
  --cli-input-json file://infra/ecs/task-def-landing.json \
  --region ap-southeast-5

aws ecs register-task-definition \
  --cli-input-json file://infra/ecs/task-def-investor.json \
  --region ap-southeast-5

aws ecs register-task-definition \
  --cli-input-json file://infra/ecs/task-def-issuer.json \
  --region ap-southeast-5

aws ecs register-task-definition \
  --cli-input-json file://infra/ecs/task-def-admin.json \
  --region ap-southeast-5

aws ecs register-task-definition \
  --cli-input-json file://infra/ecs/task-def-migrations.json \
  --region ap-southeast-5
```

## Step 7: Create ECS Services

After creating task definitions, create the services:

```bash
# API Service
aws ecs create-service \
  --cluster cashsouk-prod \
  --service-name cashsouk-api \
  --task-definition cashsouk-api \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --region ap-southeast-5

# Landing Service
aws ecs create-service \
  --cluster cashsouk-prod \
  --service-name cashsouk-landing \
  --task-definition cashsouk-landing \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --region ap-southeast-5

# Repeat for investor, issuer, and admin services...
```

## Step 8: Push to GitHub and Deploy

Once everything is set up:

```bash
git add .
git commit -m "Add GitHub Actions CI/CD pipeline"
git push origin main
```

The deployment will automatically trigger!

## Monitoring Deployment

1. Go to your GitHub repository → Actions tab
2. You'll see the "Deploy to AWS ECS" workflow running
3. Click on it to see real-time logs

## Troubleshooting

### Common Issues:

1. **OIDC Authentication fails**: Check that the trust policy has the correct GitHub repo path
2. **ECR push fails**: Ensure the IAM role has ECR permissions
3. **ECS update fails**: Verify task definitions exist and subnets/security groups are correct
4. **Services don't stabilize**: Check CloudWatch logs for container errors

### View Logs:

```bash
aws logs tail /aws/ecs/cashsouk-api --follow --region ap-southeast-5
```

## Next Steps

After successful deployment:

1. Set up Application Load Balancer (ALB)
2. Configure Route 53 DNS
3. Set up SSL certificates with ACM
4. Configure RDS database
5. Set up Cognito User Pool
6. Add environment variables to SSM Parameter Store

