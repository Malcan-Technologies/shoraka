# AWS Authentication & Credentials Explained

This guide explains how authentication works for CashSouk deployment to AWS.

## 🔐 Two Different Authentication Flows

### 1. **Your Local Machine** → AWS (For Setup)

This is **you** setting up the infrastructure from your computer.

```
Your Computer
    ↓
  AWS CLI (configured with your credentials)
    ↓
  AWS Account (creates resources)
```

**How it works:**
1. You run `aws configure` on your machine
2. You enter AWS Access Key ID and Secret Access Key
3. AWS CLI stores these in `~/.aws/credentials`
4. When you run setup scripts, AWS CLI uses these credentials
5. Scripts create IAM roles, ECR repos, ECS cluster, etc.

**These credentials are:**
- ✅ Stored only on your local machine
- ✅ Never committed to Git
- ✅ Never uploaded to GitHub
- ✅ Used only for initial setup and management

**What you need:**
- AWS account with admin or appropriate permissions
- AWS Access Keys (from IAM console)

**Get your AWS Access Keys:**
1. Go to AWS Console → IAM → Users
2. Click on your username
3. Go to "Security credentials" tab
4. Click "Create access key"
5. Choose "Command Line Interface (CLI)"
6. Download or copy the keys

### 2. **GitHub Actions** → AWS (For Deployment)

This is **automated deployment** from GitHub when you push code.

```
GitHub Actions
    ↓
  OIDC Token (temporary, per-run)
    ↓
  Assumes GitHubActionsDeployRole
    ↓
  Temporary AWS Credentials (15 min)
    ↓
  Deploys to ECS
```

**How it works:**
1. You push code to GitHub `main` branch
2. GitHub Actions workflow starts
3. GitHub generates OIDC token (proves it's your repo)
4. GitHub uses token to assume `GitHubActionsDeployRole` in AWS
5. AWS gives GitHub temporary credentials (valid ~15 minutes)
6. GitHub uses these to push images, update services
7. Credentials expire after workflow completes

**These credentials are:**
- ✅ Temporary (expire in minutes)
- ✅ Never stored anywhere
- ✅ Generated fresh for each workflow run
- ✅ Scoped to only deployment permissions

**What you need:**
- GitHub repository secret: `AWS_DEPLOY_ROLE_ARN`
- IAM role with OIDC trust policy (created by setup script)

## 🏗️ AWS Roles Created by Setup Script

The `complete-aws-setup.sh` script creates **3 IAM roles**:

### 1. **ecsTaskExecutionRole**

**Purpose:** Allows ECS service to start your containers

**Trust Policy:** Trusted by `ecs-tasks.amazonaws.com`

**Permissions:**
- Pull images from ECR
- Write logs to CloudWatch
- Read secrets from SSM Parameter Store

**Used by:** ECS Fargate service (not your application code)

**Think of it as:** The "ECS service account" that launches your containers

### 2. **ecsTaskRole**

**Purpose:** Your application's identity when running in ECS

**Trust Policy:** Trusted by `ecs-tasks.amazonaws.com`

**Permissions:**
- Access S3 buckets (uploads/downloads)
- Call Cognito APIs (user management)
- Read SSM parameters (configuration)

**Used by:** Your application code (API, portals)

**Think of it as:** Your app's "service account" for accessing AWS services

### 3. **GitHubActionsDeployRole**

**Purpose:** Allows GitHub Actions to deploy your application

**Trust Policy:** Trusted by GitHub OIDC provider (`token.actions.githubusercontent.com`) **only for your specific repository**

**Permissions:**
- Push images to ECR
- Update ECS task definitions
- Update ECS services
- Run migration tasks
- Pass ecsTaskExecutionRole and ecsTaskRole to ECS

**Used by:** GitHub Actions workflow

**Think of it as:** GitHub's "deployment service account"

## 📊 Complete Authentication Flow

### Initial Setup (One-Time)

```
┌─────────────────┐
│  Your Computer  │
│                 │
│ 1. aws configure│──────────────┐
└─────────────────┘              │
                                 ▼
                    ┌────────────────────────┐
                    │      AWS Account       │
                    │                        │
                    │  Your IAM User         │
                    │  (Access Keys)         │
                    └────────────────────────┘
                                 │
                    2. Run setup script
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Resources Created:   │
                    │                        │
                    │  • ecsTaskExecutionRole│
                    │  • ecsTaskRole         │
                    │  • GitHubActionsRole   │
                    │  • ECR Repositories    │
                    │  • ECS Cluster         │
                    │  • CloudWatch Logs     │
                    │  • OIDC Provider       │
                    └────────────────────────┘
```

### Every Deployment (Automated)

```
┌─────────────────┐
│   Developer     │
│                 │
│  git push       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ GitHub Actions  │
│                 │
│ 1. OIDC token   │──────────────┐
└─────────────────┘              │
                                 ▼
                    ┌────────────────────────┐
                    │      AWS Account       │
                    │                        │
                    │  2. Verify OIDC token  │
                    │  3. Return temp creds  │
                    └────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  GitHub Actions with   │
                    │  Temporary AWS Creds   │
                    │                        │
                    │  4. Build images       │
                    │  5. Push to ECR        │
                    │  6. Update ECS         │
                    └────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │    ECS Fargate         │
                    │                        │
                    │  7. Pull images (as    │
                    │     ecsTaskExecution   │
                    │     Role)              │
                    │                        │
                    │  8. Run containers (as │
                    │     ecsTaskRole)       │
                    └────────────────────────┘
```

## 🔒 Security Best Practices

### ✅ What We Do Right

1. **OIDC for CI/CD**: No long-lived credentials in GitHub
2. **Temporary credentials**: GitHub's access expires after each run
3. **Least privilege**: Each role has minimum required permissions
4. **Repository-specific**: GitHub Actions role only works for your repo
5. **Branch-specific**: Only `main` branch can deploy

### ✅ What You Should Do

1. **Rotate your AWS access keys** regularly (every 90 days)
2. **Use IAM user**, not root account, for AWS CLI
3. **Enable MFA** on your AWS IAM user
4. **Don't commit** AWS credentials to Git (already in .gitignore)
5. **Limit permissions** - only grant what's needed

### ❌ What NOT To Do

1. ❌ Don't put AWS access keys in GitHub secrets
2. ❌ Don't use root AWS account credentials
3. ❌ Don't share AWS access keys
4. ❌ Don't hardcode credentials in code
5. ❌ Don't commit `.aws/credentials` file

## 🆘 Troubleshooting

### "Unable to locate credentials"

**Problem:** AWS CLI can't find credentials

**Solution:**
```bash
aws configure
```
Enter your Access Key ID and Secret Access Key

### "AccessDenied" when running setup script

**Problem:** Your IAM user lacks permissions

**Solution:** Your AWS user needs these permissions:
- IAM: Create roles, policies
- ECR: Create repositories
- ECS: Create clusters
- CloudWatch: Create log groups
- OIDC: Create providers

Ask your AWS admin to grant these, or use admin credentials

### "Invalid OIDC token" in GitHub Actions

**Problem:** GitHub can't assume the role

**Solution:** Check that:
1. `AWS_DEPLOY_ROLE_ARN` secret is correct
2. Trust policy has correct repo name (`YOUR_USERNAME/Shoraka`)
3. OIDC provider exists in AWS

### "Error assuming role" in GitHub Actions

**Problem:** Role ARN is wrong or doesn't exist

**Solution:**
1. Verify the role exists: `aws iam get-role --role-name GitHubActionsDeployRole`
2. Get correct ARN: `aws iam get-role --role-name GitHubActionsDeployRole --query 'Role.Arn' --output text`
3. Update GitHub secret

## 📚 Learn More

- [AWS IAM Roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)
- [GitHub OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [ECS Task IAM Roles](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
- [AWS CLI Configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)

## ✅ Quick Checklist

Before deployment, verify:

- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Can run: `aws sts get-caller-identity` (shows your AWS account)
- [ ] Ran `./scripts/complete-aws-setup.sh YOUR_GITHUB_USERNAME/Shoraka`
- [ ] Script completed without errors
- [ ] Added `AWS_DEPLOY_ROLE_ARN` to GitHub secrets
- [ ] Role ARN format: `arn:aws:iam::123456789012:role/GitHubActionsDeployRole`

Now you're ready to deploy! 🚀

