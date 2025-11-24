# GitHub Actions CI/CD Setup Summary

## ✅ What I've Created For You

### 1. GitHub Actions Workflow
**File**: `.github/workflows/deploy.yml`

This automated workflow runs on every push to `main` and:
- Installs dependencies with pnpm
- Runs typecheck, linting, and tests
- Builds 5 Docker images (API, Landing, Investor, Issuer, Admin)
- Pushes images to Amazon ECR
- Runs database migrations via ECS task
- Updates all 5 ECS services with new images
- Waits for services to stabilize
- Reports deployment status

**Features:**
- ✅ OIDC authentication (no long-lived AWS keys)
- ✅ Parallel Docker builds
- ✅ Automatic database migrations
- ✅ Zero-downtime deployments
- ✅ Deployment verification
- ✅ Detailed logging

### 2. Setup Scripts
**File**: `scripts/setup-aws-infrastructure.sh`

Automated script that creates:
- ECR repositories (5 total)
- GitHub OIDC provider in AWS
- IAM role with proper permissions
- ECS cluster

**Usage:**
```bash
./scripts/setup-aws-infrastructure.sh YOUR_GITHUB_USERNAME/Shoraka
```

### 3. Documentation

#### Quick Start Guide
**File**: `DEPLOYMENT_QUICKSTART.md`
- Step-by-step deployment instructions
- What happens during deployment
- Monitoring and troubleshooting
- Next steps after deployment

#### Detailed Setup Guide
**File**: `docs/deployment/github-actions-setup.md`
- Complete VPC and networking setup
- Security group configuration
- ECS task definitions
- Detailed AWS CLI commands
- Troubleshooting section

### 4. Updated README
**File**: `README.md`
- Added quick start section
- Links to deployment guides
- Clear navigation for new users

## 📋 What You Need To Do Next

### Immediate Actions (Required for Deployment)

#### 0. Configure AWS CLI (MUST DO FIRST!)

You need AWS credentials on your local machine to run the setup scripts.

**Install AWS CLI** (if not already installed):
- Mac: `brew install awscli`
- Windows: Download from [AWS](https://aws.amazon.com/cli/)
- Linux: `sudo apt install awscli` or similar

**Configure your credentials:**
```bash
aws configure
```

You'll need:
- **AWS Access Key ID** - Get from AWS Console → IAM → Users → Your user → Security credentials → Create access key
- **Secret Access Key** - Shown when you create the access key (copy it!)
- **Region**: `ap-southeast-5`
- **Output format**: `json`

**Test it works:**
```bash
aws sts get-caller-identity
```
You should see your AWS account ID.

**Important:** These credentials stay on your machine only. GitHub will use OIDC (no keys in GitHub).

#### 1. Run the Complete AWS Setup Script
```bash
./scripts/complete-aws-setup.sh YOUR_GITHUB_USERNAME/Shoraka
```
Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

**Example:**
```bash
./scripts/complete-aws-setup.sh ivan/Shoraka
```

**This script creates:**
- ✅ `ecsTaskExecutionRole` - For ECS to pull images and write logs
- ✅ `ecsTaskRole` - For your app to access S3, Cognito, SSM
- ✅ `GitHubActionsDeployRole` - For GitHub Actions to deploy
- ✅ 5 ECR repositories - For Docker images
- ✅ ECS cluster - `cashsouk-prod`
- ✅ CloudWatch log groups - For application logs
- ✅ GitHub OIDC provider - For secure authentication

The script will output important values. **Copy the `AWS_DEPLOY_ROLE_ARN`!**

#### 2. Add GitHub Secrets

Go to: **GitHub Repository → Settings → Secrets and variables → Actions**

Click **"New repository secret"** and add:

| Secret Name | Where to Get It |
|-------------|-----------------|
| `AWS_DEPLOY_ROLE_ARN` | Output from setup script above |
| `PRIVATE_SUBNET_1` | From VPC setup (Step 3) |
| `PRIVATE_SUBNET_2` | From VPC setup (Step 3) |
| `ECS_SECURITY_GROUP` | From VPC setup (Step 3) |

#### 3. Set Up VPC and Networking

You have two options:

**Option A: Use Existing VPC**
- If you already have a VPC with private subnets and security groups
- Just add the subnet and security group IDs as GitHub secrets

**Option B: Create New VPC**
- Follow the detailed guide: `docs/deployment/github-actions-setup.md` (Step 4)
- This creates a complete VPC with public/private subnets, NAT gateway, security groups

#### 4. Create Initial ECS Task Definitions and Services

**First**, get your ECR registry URL:
```bash
aws ecr describe-repositories --region ap-southeast-5 --query 'repositories[0].repositoryUri' --output text | sed 's|/.*||'
```

**Then**, update the task definition files in `infra/ecs/`:
- Replace `YOUR_ECR_REGISTRY` with the URL above
- Update environment variables as needed

**Next**, register task definitions:
```bash
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-api.json --region ap-southeast-5
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-landing.json --region ap-southeast-5
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-investor.json --region ap-southeast-5
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-issuer.json --region ap-southeast-5
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-admin.json --region ap-southeast-5
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-migrations.json --region ap-southeast-5
```

**Finally**, create the services. See `DEPLOYMENT_QUICKSTART.md` (Step 5.2) for detailed commands.

#### 5. Push to GitHub

Once all secrets are added and services are created:

```bash
git add .
git commit -m "Add GitHub Actions CI/CD pipeline"
git push origin main
```

**Watch your deployment live** at: `https://github.com/YOUR_USERNAME/Shoraka/actions`

### Recommended Next Steps (After First Deployment)

Once your services are running, you'll want to:

1. **Set Up Application Load Balancer**
   - Route traffic to your ECS services
   - Configure SSL/TLS
   - Set up host-based routing for subdomains

2. **Configure DNS**
   - Point domain to ALB
   - Set up subdomains (investor.cashsouk.com, issuer.cashsouk.com, etc.)

3. **Set Up RDS Database**
   - PostgreSQL instance
   - Update `DATABASE_URL` in task definitions

4. **Configure AWS Cognito**
   - Create User Pool
   - Set up Hosted UI
   - Configure callback URLs

5. **Add Environment Variables**
   - Store in AWS SSM Parameter Store
   - Update task definitions to reference them

## 🎯 Deployment Flow

```
Developer pushes to main
         ↓
GitHub Actions triggered
         ↓
Install deps → Lint → Test
         ↓
Build 5 Docker images
         ↓
Push to ECR with commit SHA tag
         ↓
Run database migrations
         ↓
Update 5 ECS services
         ↓
Wait for stabilization
         ↓
✅ Deployment complete!
```

## 📊 Monitoring

### View Deployment Progress
1. GitHub → Actions tab
2. Click on running workflow
3. Watch real-time logs

### Check ECS Services
```bash
aws ecs describe-services \
  --cluster cashsouk-prod \
  --services cashsouk-api cashsouk-landing cashsouk-investor cashsouk-issuer cashsouk-admin \
  --region ap-southeast-5
```

### View Container Logs
```bash
aws logs tail /aws/ecs/cashsouk-api --follow --region ap-southeast-5
aws logs tail /aws/ecs/cashsouk-landing --follow --region ap-southeast-5
```

## 🔒 Security Features

✅ **OIDC Authentication**: No long-lived AWS access keys stored in GitHub
✅ **IAM Role Scoped**: Only allows access to specific resources
✅ **Private Subnets**: ECS tasks run in private subnets with no public IPs
✅ **Security Groups**: Strict network access controls
✅ **Encrypted Images**: ECR repositories support encryption at rest

## 🆘 Troubleshooting

### Deployment fails at "Configure AWS credentials"
- **Cause**: Missing `AWS_DEPLOY_ROLE_ARN` secret or incorrect role ARN
- **Fix**: Verify GitHub secret matches the IAM role ARN from setup script

### "ECR repository not found"
- **Cause**: ECR repositories not created
- **Fix**: Run `./scripts/setup-aws-infrastructure.sh` again

### Services fail to stabilize
- **Cause**: Container crashes or missing environment variables
- **Fix**: Check CloudWatch logs for the specific service

### Migration task fails
- **Cause**: Database not accessible or connection string incorrect
- **Fix**: Verify RDS is running and `DATABASE_URL` is correct in task definition

## 📚 Documentation Reference

- **Quick Start**: `DEPLOYMENT_QUICKSTART.md`
- **Detailed Setup**: `docs/deployment/github-actions-setup.md`
- **AWS Infrastructure**: `docs/architecture/aws-infrastructure.md`
- **Environment Variables**: `docs/guides/environment-variables.md`

## 🎉 Ready to Deploy?

Follow these steps in order:

1. ✅ Run `./scripts/setup-aws-infrastructure.sh YOUR_GITHUB_USERNAME/Shoraka`
2. ✅ Add GitHub secrets (4 total)
3. ✅ Set up VPC and networking (if needed)
4. ✅ Create task definitions and services
5. ✅ Push to GitHub: `git push origin main`

**That's it!** Your automated CI/CD pipeline is now active. Every future push to `main` will automatically deploy to AWS ECS.

---

**Need help?** Check the detailed guides or reach out!

