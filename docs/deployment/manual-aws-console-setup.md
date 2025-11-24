# Manual AWS Console Setup Guide

This guide walks you through setting up AWS infrastructure manually via the web console instead of using the automated script.

**⚠️ Note:** This takes 30-45 minutes. The automated script (`complete-aws-setup.sh`) does this in 3 minutes. Use this guide if you want to learn or prefer visual setup.

## Prerequisites

- AWS account with admin or appropriate IAM permissions
- Web browser
- Your GitHub repository name (e.g., `ivan/Shoraka`)

---

## Part 1: Create IAM Roles (20 minutes)

### 1.1 Create ecsTaskExecutionRole

**Purpose:** Allows ECS to pull images from ECR and write logs

1. Go to **AWS Console** → **IAM** → **Roles**
2. Click **Create role**
3. **Trusted entity type**: AWS service
4. **Use case**: Elastic Container Service → Elastic Container Service Task
5. Click **Next**
6. **Add permissions** - Search and select:
   - ✅ `AmazonECSTaskExecutionRolePolicy` (AWS managed)
   - ✅ `AmazonSSMReadOnlyAccess` (AWS managed)
7. Click **Next**
8. **Role name**: `ecsTaskExecutionRole`
9. **Description**: `Allows ECS tasks to pull images and write logs`
10. Click **Create role**

✅ **Verify:** Role appears in list with 2 policies attached

---

### 1.2 Create ecsTaskRole

**Purpose:** Allows your application to access AWS services (S3, Cognito, SSM)

#### Step 1: Create the role

1. Go to **IAM** → **Roles** → **Create role**
2. **Trusted entity type**: AWS service
3. **Use case**: Elastic Container Service → Elastic Container Service Task
4. Click **Next**
5. **Don't add any policies yet** (we'll create custom policy)
6. Click **Next**
7. **Role name**: `ecsTaskRole`
8. **Description**: `Allows CashSouk application to access S3, Cognito, and SSM`
9. Click **Create role**

#### Step 2: Create custom policy

1. Go to **IAM** → **Policies** → **Create policy**
2. Click **JSON** tab
3. Paste this policy:

```json
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
      "Resource": "arn:aws:cognito-idp:ap-southeast-5:*:userpool/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:ap-southeast-5:*:parameter/cashsouk/*"
    }
  ]
}
```

4. Click **Next**
5. **Policy name**: `CashSoukECSTaskPolicy`
6. **Description**: `Permissions for CashSouk application`
7. Click **Create policy**

#### Step 3: Attach policy to role

1. Go to **IAM** → **Roles** → Find **ecsTaskRole** → Click it
2. Click **Add permissions** → **Attach policies**
3. Search for `CashSoukECSTaskPolicy`
4. Select it and click **Attach policies**

✅ **Verify:** `ecsTaskRole` has 1 policy attached

---

### 1.3 Create GitHub OIDC Provider

**Purpose:** Allows GitHub Actions to authenticate with AWS without storing credentials

1. Go to **IAM** → **Identity providers** → **Add provider**
2. **Provider type**: OpenID Connect
3. **Provider URL**: `https://token.actions.githubusercontent.com`
4. Click **Get thumbprint** (should auto-fill)
5. **Audience**: `sts.amazonaws.com`
6. Click **Add provider**

✅ **Verify:** Provider appears in list

---

### 1.4 Create GitHubActionsDeployRole

**Purpose:** Allows GitHub Actions to deploy to ECS

#### Step 1: Get your AWS Account ID

1. Click your username in top right → Account ID is shown
2. **Copy this!** You'll need it multiple times

#### Step 2: Create trust policy

1. Go to **IAM** → **Roles** → **Create role**
2. **Trusted entity type**: Custom trust policy
3. Click **Custom trust policy** tab
4. Paste this (replace `123456789012` with your Account ID and `ivan/Shoraka` with your repo):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:ivan/Shoraka:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

5. Click **Next**

#### Step 3: Create and attach permission policy

1. **Don't select any policies yet**
2. Click **Next**
3. **Role name**: `GitHubActionsDeployRole`
4. **Description**: `Allows GitHub Actions to deploy CashSouk to ECS`
5. Click **Create role**

#### Step 4: Create deploy policy

1. Go to **IAM** → **Policies** → **Create policy**
2. Click **JSON** tab
3. Paste this (replace `123456789012` with your Account ID):

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
        "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
        "arn:aws:iam::123456789012:role/ecsTaskRole"
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
```

4. Click **Next**
5. **Policy name**: `GitHubActionsDeployPolicy`
6. **Description**: `Permissions for GitHub Actions to deploy CashSouk`
7. Click **Create policy**

#### Step 5: Attach policy to role

1. Go to **IAM** → **Roles** → Find **GitHubActionsDeployRole** → Click it
2. Click **Add permissions** → **Attach policies**
3. Search for `GitHubActionsDeployPolicy`
4. Select it and click **Attach policies**

#### Step 6: Copy the Role ARN

1. In the **GitHubActionsDeployRole** details page
2. **Copy the ARN** at the top (looks like: `arn:aws:iam::123456789012:role/GitHubActionsDeployRole`)
3. **Save this!** You'll add it as a GitHub secret

✅ **Verify:** All 3 roles created with correct policies

---

## Part 2: Create ECR Repositories (10 minutes)

### 2.1 Create Repositories

You need to create 5 repositories (one for each service).

**For each service** (api, landing, investor, issuer, admin):

1. Go to **AWS Console** → **ECR** (Elastic Container Registry)
2. Click **Create repository**
3. **Visibility settings**: Private
4. **Repository name**: `cashsouk-<SERVICE_NAME>`
   - `cashsouk-api`
   - `cashsouk-landing`
   - `cashsouk-investor`
   - `cashsouk-issuer`
   - `cashsouk-admin`
5. **Tag immutability**: Disabled (allows overwriting `latest` tag)
6. **Image scan settings**: ✅ Enable scan on push
7. **Encryption settings**: AES-256
8. Click **Create repository**

**Repeat 5 times** for all services.

✅ **Verify:** 5 repositories created in ECR

---

## Part 3: Create ECS Cluster (2 minutes)

1. Go to **AWS Console** → **ECS** (Elastic Container Service)
2. Click **Clusters** → **Create cluster**
3. **Cluster name**: `cashsouk-prod`
4. **Infrastructure**: AWS Fargate (serverless)
5. **Monitoring**: ✅ Use Container Insights (optional but recommended)
6. Click **Create**

✅ **Verify:** Cluster status is "Active"

---

## Part 4: Create CloudWatch Log Groups (5 minutes)

### 4.1 Create Log Groups

**For each service** (api, landing, investor, issuer, admin, migrations):

1. Go to **AWS Console** → **CloudWatch** → **Log groups**
2. Click **Create log group**
3. **Log group name**: `/aws/ecs/cashsouk-<SERVICE_NAME>`
   - `/aws/ecs/cashsouk-api`
   - `/aws/ecs/cashsouk-landing`
   - `/aws/ecs/cashsouk-investor`
   - `/aws/ecs/cashsouk-issuer`
   - `/aws/ecs/cashsouk-admin`
   - `/aws/ecs/cashsouk-migrations`
4. **Retention setting**: 30 days
5. Click **Create**

**Repeat 6 times** for all services.

✅ **Verify:** 6 log groups created

---

## Part 5: Add GitHub Secret (2 minutes)

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. **Name**: `AWS_DEPLOY_ROLE_ARN`
5. **Value**: (paste the ARN you copied from Step 1.4.6)
6. Click **Add secret**

✅ **Verify:** Secret appears in list

---

## ✅ Manual Setup Complete!

You've created:
- ✅ 3 IAM Roles (ecsTaskExecutionRole, ecsTaskRole, GitHubActionsDeployRole)
- ✅ 2 IAM Policies (CashSoukECSTaskPolicy, GitHubActionsDeployPolicy)
- ✅ 1 OIDC Provider (GitHub)
- ✅ 5 ECR Repositories
- ✅ 1 ECS Cluster
- ✅ 6 CloudWatch Log Groups
- ✅ 1 GitHub Secret

---

## 📋 Verification Checklist

Before proceeding, verify:

**IAM Roles:**
- [ ] ecsTaskExecutionRole exists with 2 policies
- [ ] ecsTaskRole exists with CashSoukECSTaskPolicy
- [ ] GitHubActionsDeployRole exists with GitHubActionsDeployPolicy
- [ ] GitHubActionsDeployRole trust policy references your GitHub repo

**ECR:**
- [ ] cashsouk-api repository exists
- [ ] cashsouk-landing repository exists
- [ ] cashsouk-investor repository exists
- [ ] cashsouk-issuer repository exists
- [ ] cashsouk-admin repository exists

**ECS:**
- [ ] cashsouk-prod cluster exists and is Active

**CloudWatch:**
- [ ] 6 log groups exist under /aws/ecs/cashsouk-*

**GitHub:**
- [ ] AWS_DEPLOY_ROLE_ARN secret added

---

## 🔄 What's Next?

Continue with **DEPLOYMENT_QUICKSTART.md** at **Step 3: Set Up VPC and Networking**

You can also set up VPC manually or use AWS CLI commands from the guide.

---

## 🆘 Troubleshooting Manual Setup

### Common Mistakes

**❌ Wrong trust policy format**
- Make sure to replace Account ID and GitHub repo name
- Check for typos in ARN format

**❌ Missing policies**
- ecsTaskExecutionRole needs 2 policies
- Each custom role needs exactly 1 custom policy attached

**❌ Wrong repository names**
- Must be lowercase: `cashsouk-api` not `CashSouk-API`
- Must match exactly what's in GitHub Actions workflow

**❌ Wrong region**
- Everything should be in `ap-southeast-5` (Malaysia)
- Check region selector in top right of console

### Verification Commands

If you have AWS CLI set up, verify your manual setup:

```bash
# Check IAM roles
aws iam get-role --role-name ecsTaskExecutionRole
aws iam get-role --role-name ecsTaskRole
aws iam get-role --role-name GitHubActionsDeployRole

# Check ECR repos
aws ecr describe-repositories --region ap-southeast-5

# Check ECS cluster
aws ecs describe-clusters --clusters cashsouk-prod --region ap-southeast-5

# Check log groups
aws logs describe-log-groups --log-group-name-prefix /aws/ecs/cashsouk --region ap-southeast-5
```

---

## 💡 Pro Tips

1. **Take screenshots** as you create each resource (helps if you need to recreate)
2. **Copy ARNs** to a text file as you create resources
3. **Double-check** account IDs and repo names in trust policies
4. **Use tags** (optional): Add tags like `Project: CashSouk` to all resources for tracking
5. **Set up billing alerts** if you haven't already

---

## 🤔 CLI Script vs Manual - When to Use What?

**Use CLI Script when:**
- You want fast, automated setup
- You need to recreate in multiple accounts/regions
- You want infrastructure as code
- You're comfortable with command line

**Use Manual Console when:**
- You're learning AWS for the first time
- You want to see exactly what's being created
- You prefer visual interfaces
- You want to understand each component

**Best of both worlds:**
- Create manually first time to learn
- Document what you did
- Use script for future setups or other environments

