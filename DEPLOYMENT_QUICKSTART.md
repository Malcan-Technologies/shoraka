# CashSouk Deployment Quick Start

This guide will help you deploy CashSouk to AWS ECS Fargate with automated CI/CD from GitHub.

## 🚀 Quick Setup (5 Steps)

### Step 1: Prerequisites

Ensure you have:

- ✅ **AWS CLI installed** - [Install Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- ✅ **AWS CLI configured with credentials** - Run `aws configure` (see below)
- ✅ GitHub account with this repository
- ✅ AWS account with admin/deployment permissions
- ✅ Docker installed locally (for testing)

#### Configure AWS CLI (Required!)

Run this command on your local machine:

```bash
aws configure
```

You'll be prompted for:

- **AWS Access Key ID**: Get from AWS Console → IAM → Users → Security credentials
- **AWS Secret Access Key**: Get from same place (or create new access key)
- **Default region name**: `ap-southeast-5`
- **Default output format**: `json`

These credentials are **only for your local machine** to set up the infrastructure. GitHub Actions will use OIDC authentication (no long-lived keys in GitHub).

**Test your configuration:**

```bash
aws sts get-caller-identity
```

You should see your AWS account ID and user ARN.

### Step 2: Run Complete AWS Setup

**Choose one approach:**

#### Option A: Automated Script ⚡ (RECOMMENDED - 3 minutes)

This script creates **everything** needed for ECS deployment automatically.

```bash
./scripts/complete-aws-setup.sh YOUR_GITHUB_USERNAME/Shoraka
```

**Example:**

```bash
./scripts/complete-aws-setup.sh ivan/Shoraka
```

**What this creates:**

- ✅ `ecsTaskExecutionRole` - Allows ECS to pull images from ECR and write logs
- ✅ `ecsTaskRole` - Allows your application to access S3, Cognito, SSM
- ✅ `GitHubActionsDeployRole` - Allows GitHub Actions to deploy (OIDC, no keys!)
- ✅ ECR repositories (5) - For Docker images
- ✅ ECS cluster - `cashsouk-prod`
- ✅ CloudWatch log groups (6) - For application logs

The script will output important values. **Copy the `AWS_DEPLOY_ROLE_ARN`!**

#### Option B: Manual Setup via AWS Console 🖱️ (30-45 minutes)

Prefer clicking through the AWS web interface? See the detailed guide:
**[docs/deployment/manual-aws-console-setup.md](./docs/deployment/manual-aws-console-setup.md)**

**When to use manual setup:**

- 🎓 First time using AWS and want to learn
- 👀 Want to see exactly what's being created
- 🖱️ Prefer visual interfaces over command line
- 📸 Want to understand each component

**After manual setup, return here and continue with Step 3.**

### Step 3: Set Up VPC and Networking

#### Option A: Quick Setup (Simple)

If you already have a VPC with public and private subnets, skip to adding GitHub secrets.

#### Option B: Full Setup (New VPC)

Run these commands to create a complete VPC setup:

```bash
cd /Users/ivan/Documents/Shoraka

# Set your AWS region
export AWS_REGION=ap-southeast-5

# Run the VPC setup from the detailed guide
# See: docs/deployment/github-actions-setup.md (Step 4.1)
```

This creates:

- VPC with 2 public and 2 private subnets
- Internet Gateway and NAT Gateway
- Security Groups for ALB, ECS, and RDS
- Route tables

**Save the output IDs!** You'll need:

- Private Subnet 1 ID
- Private Subnet 2 ID
- ECS Security Group ID

### Step 4: Configure GitHub Secrets

Go to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

Add these secrets:

| Secret Name           | Description                 | Example Value                                            |
| --------------------- | --------------------------- | -------------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN for deployment | `arn:aws:iam::123456789012:role/GitHubActionsDeployRole` |
| `PRIVATE_SUBNET_1`    | First private subnet ID     | `subnet-0abc123def456`                                   |
| `PRIVATE_SUBNET_2`    | Second private subnet ID    | `subnet-0def456abc123`                                   |
| `ECS_SECURITY_GROUP`  | ECS tasks security group    | `sg-0abc123def456`                                       |

### Step 5: Initial Build and Deploy

#### 5.1 Build Initial Images

```bash
# Build all Docker images
./scripts/build-all.sh

# Login to ECR and push images
./scripts/push-to-ecr.sh
```

#### 5.2 Create Task Definitions and Services

First, update the task definition files in `infra/ecs/` with your ECR repository URIs.

Get your ECR registry URL:

```bash
aws ecr describe-repositories --region ap-southeast-5 --query 'repositories[0].repositoryUri' --output text | sed 's|/.*||'
```

Then update each `task-def-*.json` file, replacing `YOUR_ECR_REGISTRY` with the output above.

Create task definitions:

```bash
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-api.json --region ap-southeast-5
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-landing.json --region ap-southeast-5
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-investor.json --region ap-southeast-5
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-issuer.json --region ap-southeast-5
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-admin.json --region ap-southeast-5
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-migrations.json --region ap-southeast-5
```

Create services:

```bash
# Get your subnet and security group IDs from Step 3
PRIVATE_SUBNET_1="subnet-xxx"  # Replace with your subnet ID
PRIVATE_SUBNET_2="subnet-yyy"  # Replace with your subnet ID
ECS_SG="sg-zzz"                # Replace with your security group ID

# Create API service
aws ecs create-service \
  --cluster cashsouk-prod \
  --service-name cashsouk-api \
  --task-definition cashsouk-api \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --region ap-southeast-5

# Create Landing service
aws ecs create-service \
  --cluster cashsouk-prod \
  --service-name cashsouk-landing \
  --task-definition cashsouk-landing \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --region ap-southeast-5

# Create Investor service
aws ecs create-service \
  --cluster cashsouk-prod \
  --service-name cashsouk-investor \
  --task-definition cashsouk-investor \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --region ap-southeast-5

# Create Issuer service
aws ecs create-service \
  --cluster cashsouk-prod \
  --service-name cashsouk-issuer \
  --task-definition cashsouk-issuer \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --region ap-southeast-5

# Create Admin service
aws ecs create-service \
  --cluster cashsouk-prod \
  --service-name cashsouk-admin \
  --task-definition cashsouk-admin \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --region ap-southeast-5
```

#### 5.3 Push to GitHub

Once everything is set up, push to GitHub to trigger automated deployment:

```bash
git add .
git commit -m "Set up GitHub Actions CI/CD"
git push origin main
```

Go to **GitHub → Actions** tab to watch the deployment!

## 🎯 What Happens Next

When you push to `main` branch, GitHub Actions will:

1. ✅ Install dependencies with pnpm
2. ✅ Run TypeScript typecheck
3. ✅ Run linting
4. ✅ Run tests
5. ✅ Build all 5 Docker images (API, Landing, Investor, Issuer, Admin)
6. ✅ Push images to ECR with commit SHA as tag
7. ✅ Run database migrations
8. ✅ Update all 5 ECS services with new images
9. ✅ Wait for services to stabilize
10. ✅ Report deployment success

## 📊 Monitoring Your Deployment

### View GitHub Actions Logs

1. Go to your GitHub repository
2. Click **Actions** tab
3. Click on the running workflow
4. Watch real-time logs

### View ECS Service Status

```bash
aws ecs describe-services \
  --cluster cashsouk-prod \
  --services cashsouk-api cashsouk-landing cashsouk-investor cashsouk-issuer cashsouk-admin \
  --region ap-southeast-5 \
  --query 'services[*].[serviceName,status,runningCount,desiredCount]' \
  --output table
```

### View Container Logs

```bash
# API logs
aws logs tail /aws/ecs/cashsouk-api --follow --region ap-southeast-5

# Landing logs
aws logs tail /aws/ecs/cashsouk-landing --follow --region ap-southeast-5

# Investor logs
aws logs tail /aws/ecs/cashsouk-investor --follow --region ap-southeast-5
```

## 🔧 Next Steps

After successful deployment, you'll want to:

### 1. Set Up Application Load Balancer (ALB)

- Route traffic to ECS services
- Configure SSL/TLS certificates
- Set up host-based routing for subdomains

### 2. Configure DNS

- Point your domain to ALB
- Set up subdomains (investor, issuer, admin, api)

### 3. Set Up RDS Database

- PostgreSQL instance in private subnets
- Configure security group to allow ECS access
- Update `DATABASE_URL` in task definitions

### 4. Configure AWS Cognito

- Create User Pool
- Set up Hosted UI
- Configure callback URLs
- Add custom `roles` attribute

### 5. Add Environment Variables

- Store secrets in AWS SSM Parameter Store
- Update task definitions to reference secrets
- Add Cognito configuration

### 6. Enable HTTPS

- Request ACM certificate
- Attach to ALB
- Redirect HTTP to HTTPS

## 📚 Additional Resources

- **Detailed Setup Guide**: `docs/deployment/github-actions-setup.md`
- **AWS Infrastructure**: `docs/architecture/aws-infrastructure.md`
- **Deployment Guide**: `docs/deployment/deployment.md`
- **Environment Variables**: `docs/guides/environment-variables.md`

## 🆘 Troubleshooting

### Deployment fails at "Run database migrations"

- **Cause**: Database not accessible or migration task definition missing
- **Fix**: Ensure RDS is running and accessible from ECS tasks

### Images fail to push to ECR

- **Cause**: IAM permissions or repository doesn't exist
- **Fix**: Check that ECR repositories exist and IAM role has `ecr:PutImage` permission

### ECS service fails to stabilize

- **Cause**: Container crashes or health check fails
- **Fix**: Check CloudWatch logs for container errors

### "OIDC authentication failed"

- **Cause**: GitHub repository name mismatch in IAM trust policy
- **Fix**: Verify the trust policy has correct `repo:USERNAME/Shoraka:ref:refs/heads/main`

### Need help?

Check the detailed guides in `docs/deployment/` or AWS CloudWatch logs.

## ✅ Verification Checklist

Before going live, verify:

- [ ] All 5 services running in ECS
- [ ] Database migrations applied successfully
- [ ] ALB routing to all services correctly
- [ ] HTTPS enabled with valid certificate
- [ ] DNS records pointing to ALB
- [ ] Cognito User Pool configured
- [ ] Environment variables set in SSM
- [ ] CloudWatch alarms configured
- [ ] Logs flowing to CloudWatch
- [ ] Automated deployments working from GitHub

---

**Congratulations!** 🎉 Your CI/CD pipeline is ready. Every push to `main` will now automatically deploy to AWS ECS!
