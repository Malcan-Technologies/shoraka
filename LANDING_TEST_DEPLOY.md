# Landing Page Test Deployment Guide

Quick guide to test CI/CD pipeline with just the landing page.

## ✅ What You Have

- ✅ ECR Repository: `landing-cashsouk`
- ✅ IAM Role: `arn:aws:iam::652821469470:role/GitHubActionsECRPushRole`
- ✅ GitHub Actions workflow: `.github/workflows/deploy-landing-test.yml`

## 🔧 Setup Steps

### Step 1: Add GitHub Secret

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add this secret:

**Secret #1 (Required):**

- **Name:** `AWS_DEPLOY_ROLE_ARN`
- **Value:** `arn:aws:iam::652821469470:role/GitHubActionsECRPushRole`

**Secret #2 (Optional - only if needed for build):**

- **Name:** `NEXT_PUBLIC_API_URL`
- **Value:** `https://api.cashsouk.com` (or your API URL)
  - If you don't have an API yet, you can skip this or use a placeholder

### Step 2: Verify IAM Role Permissions

Make sure your `GitHubActionsECRPushRole` has these permissions:

**Required permissions:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:ap-southeast-5:652821469470:repository/landing-cashsouk"
    }
  ]
}
```

**Check this in AWS Console:**

1. Go to **IAM** → **Roles** → `GitHubActionsECRPushRole`
2. Click **Permissions** tab
3. Verify it has ECR push permissions

### Step 3: Verify IAM Trust Policy

The role must trust GitHub OIDC for your repository.

**Required trust policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::652821469470:oidc-provider/token.actions.githubusercontent.com"
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

**Check this in AWS Console:**

1. Go to **IAM** → **Roles** → `GitHubActionsECRPushRole`
2. Click **Trust relationships** tab
3. Click **Edit trust policy**
4. Make sure it has:
   - Federated: `arn:aws:iam::652821469470:oidc-provider/token.actions.githubusercontent.com`
   - Condition includes your GitHub repo path (e.g., `repo:ivan/Shoraka:ref:refs/heads/main`)

### Step 4: Verify GitHub OIDC Provider Exists

**Check in AWS Console:**

1. Go to **IAM** → **Identity providers**
2. Verify you have: `token.actions.githubusercontent.com`
3. If not, create it:
   - **Provider type:** OpenID Connect
   - **Provider URL:** `https://token.actions.githubusercontent.com`
   - **Audience:** `sts.amazonaws.com`

### Step 5: Push to GitHub and Test

Once secrets are added:

```bash
git add .
git commit -m "Add landing page test deployment"
git push origin main
```

### Step 6: Monitor Deployment

1. Go to **GitHub** → Your repository → **Actions** tab
2. You'll see "Deploy Landing Page (Test)" workflow running
3. Click on it to see real-time logs

**Expected flow:**

1. ✅ Checkout code
2. ✅ Setup pnpm and Node.js
3. ✅ Install dependencies
4. ✅ Build landing page
5. ✅ Configure AWS credentials (OIDC)
6. ✅ Login to ECR
7. ✅ Build Docker image
8. ✅ Push to ECR with two tags:
   - `652821469470.dkr.ecr.ap-southeast-5.amazonaws.com/landing-cashsouk:<commit-sha>`
   - `652821469470.dkr.ecr.ap-southeast-5.amazonaws.com/landing-cashsouk:latest`

## 🔍 Verify Images in ECR

After successful deployment:

1. Go to **AWS Console** → **ECR** → **Repositories**
2. Click **landing-cashsouk**
3. You should see images with tags:
   - `latest`
   - Your commit SHA (e.g., `a1b2c3d4`)

## 🆘 Troubleshooting

### Error: "No OIDC provider found"

**Problem:** GitHub OIDC provider doesn't exist in your AWS account

**Solution:**

1. Go to **IAM** → **Identity providers** → **Add provider**
2. **Provider type:** OpenID Connect
3. **Provider URL:** `https://token.actions.githubusercontent.com`
4. Click **Get thumbprint**
5. **Audience:** `sts.amazonaws.com`
6. Click **Add provider**

### Error: "Not authorized to perform: sts:AssumeRoleWithWebIdentity"

**Problem:** Trust policy doesn't match your GitHub repository

**Solution:**

1. Go to **IAM** → **Roles** → `GitHubActionsECRPushRole`
2. Click **Trust relationships** → **Edit trust policy**
3. Update the `sub` condition to match: `repo:YOUR_GITHUB_USERNAME/Shoraka:ref:refs/heads/main`
4. Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username

### Error: "AccessDenied for ecr:PutImage"

**Problem:** IAM role lacks ECR push permissions

**Solution:**

1. Go to **IAM** → **Roles** → `GitHubActionsECRPushRole`
2. Click **Add permissions** → **Create inline policy**
3. Use the JSON from Step 2 above
4. Save the policy

### Error: "Repository does not exist"

**Problem:** ECR repository name mismatch

**Solution:**
Verify repository name is exactly `landing-cashsouk` (not `cashsouk-landing`)

### Build fails with "Cannot find module"

**Problem:** Missing dependencies or incorrect build command

**Solution:**
Check that all packages are listed in the Dockerfile COPY commands

## 📊 What This Workflow Does

1. **Triggers on:**
   - Push to `main` branch that changes landing page or packages
   - Manual trigger via GitHub Actions UI

2. **Builds:**
   - Installs dependencies with pnpm
   - Builds Next.js landing page in standalone mode
   - Creates optimized Docker image

3. **Pushes:**
   - Uses OIDC to authenticate with AWS (no long-lived keys!)
   - Pushes image to ECR with commit SHA and `latest` tags
   - Outputs image URIs for verification

## 🎯 Next Steps After Successful Test

Once this works, you can:

1. **Add ECS deployment** - Actually run the container
2. **Add other services** - API, investor, issuer, admin
3. **Add ALB** - Route traffic to containers
4. **Add RDS** - Database for the API
5. **Add domain** - Point cashsouk.com to your app

## ✅ Success Criteria

You'll know it's working when:

- ✅ GitHub Actions workflow completes successfully
- ✅ Green checkmark on the workflow run
- ✅ ECR repository shows new images
- ✅ Images have correct tags (commit SHA + latest)
- ✅ No error messages in workflow logs

## 📋 Quick Checklist

Before pushing:

- [ ] Added `AWS_DEPLOY_ROLE_ARN` GitHub secret
- [ ] Added `NEXT_PUBLIC_API_URL` GitHub secret (optional)
- [ ] Verified IAM role has ECR push permissions
- [ ] Verified IAM trust policy includes your GitHub repo
- [ ] Verified GitHub OIDC provider exists in AWS
- [ ] Verified ECR repository exists and is named `landing-cashsouk`

## 🎉 Ready to Test!

If all checkboxes above are checked, push to GitHub and watch the magic happen!

```bash
git add .
git commit -m "Test landing page deployment"
git push origin main
```

Then go to: `https://github.com/YOUR_USERNAME/Shoraka/actions`
