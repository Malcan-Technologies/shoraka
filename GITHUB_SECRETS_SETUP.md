# GitHub Secrets Setup Guide

Quick reference for adding secrets to GitHub for the landing page deployment.

## 📍 Where to Add Secrets

1. Go to your GitHub repository
2. Click **Settings**
3. Click **Secrets and variables** (left sidebar)
4. Click **Actions**
5. Click **New repository secret**

---

## 🔑 Secrets to Add

### ✅ REQUIRED (Add These Two Secrets)

#### Secret #1: AWS Deployment Role

- **Name:** `AWS_DEPLOY_ROLE_ARN`
- **Value:** `arn:aws:iam::652821469470:role/GitHubActionsECRPushRole`

**Why:** This allows GitHub Actions to authenticate with AWS and push Docker images to ECR.

---

#### Secret #2: Landing Page Environment Variables (NEW!)

- **Name:** `LANDING_ENV_PROD`
- **Value:** Copy the **ENTIRE contents** of `env-templates/landing.env.prod`

**How to copy:**

1. Open `env-templates/landing.env.prod` in your editor
2. Select ALL (Cmd+A or Ctrl+A)
3. Copy (Cmd+C or Ctrl+C)
4. Paste into GitHub secret value field

**Why:** This file contains all environment variables for the landing page build. The workflow will create `.env.production` from this secret.

**What it contains:**

- `NODE_ENV=production`
- `NEXT_PUBLIC_API_URL=https://api.cashsouk.com`
- Commented-out Cognito, analytics, and other optional configs

**Important:** Copy EVERYTHING, including comments! The workflow needs the exact file format.

---

## 🚫 DON'T Add These Yet

**Skip these for now** - add them later when you need them:

### Cognito Secrets (when you set up authentication)

- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_REGION`

### CloudFront CDN (when you set up CloudFront)

- `NEXT_PUBLIC_CLOUDFRONT_URL`

### Analytics (when you set up tracking)

- `NEXT_PUBLIC_GA_TRACKING_ID`
- `NEXT_PUBLIC_HOTJAR_ID`

### Error Tracking (when you set up Sentry)

- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

---

## 🎯 Minimum Setup for Testing

**To test the deployment pipeline, you need:**

1. ✅ `AWS_DEPLOY_ROLE_ARN` (for AWS authentication)
2. ✅ `LANDING_ENV_PROD` (for build environment variables)

The deployment will work with just these two secrets.

---

## 📸 Step-by-Step Screenshots Guide

### Step 1: Navigate to Secrets

![](https://docs.github.com/assets/cb-32501/images/help/repository/repo-actions-settings.png)

### Step 2: Click "New repository secret"

![](https://docs.github.com/assets/cb-29287/images/help/settings/actions-secrets-new-secret.png)

### Step 3: Add First Secret (AWS Role)

**Secret 1:**

```
Name:  AWS_DEPLOY_ROLE_ARN
Value: arn:aws:iam::652821469470:role/GitHubActionsECRPushRole
```

Click **"Add secret"**

### Step 4: Add Second Secret (Environment Variables)

Click **"New repository secret"** again

**Secret 2:**

```
Name:  LANDING_ENV_PROD
Value: [Copy entire contents of env-templates/landing.env.prod]
```

**To get the value:**

1. Open `env-templates/landing.env.prod`
2. Select ALL (Cmd+A / Ctrl+A)
3. Copy (Cmd+C / Ctrl+C)
4. Paste into the Value field

Click **"Add secret"**

That's it! ✅

---

## ✅ Verification

After adding both secrets, you should see:

- **Repository secrets** (2 secrets)
  - `AWS_DEPLOY_ROLE_ARN` ✓
  - `LANDING_ENV_PROD` ✓

---

## 🚀 Ready to Deploy!

Once you've added both secrets (`AWS_DEPLOY_ROLE_ARN` and `LANDING_ENV_PROD`):

```bash
git add .
git commit -m "Add landing page deployment pipeline"
git push origin main
```

Go to GitHub → Actions tab to watch it deploy! 🎉

**What happens:**

1. Workflow checks out code
2. Installs dependencies
3. Creates `.env.production` from `LANDING_ENV_PROD` secret
4. Builds Next.js landing page
5. Builds Docker image with the built app
6. Pushes to ECR repository `landing-cashsouk`

---

## 🔒 Security Notes

### ✅ Safe Practices

- Secrets are encrypted and never visible after creation
- Secrets are not exposed in logs
- Only workflows can access secrets
- Secrets are specific to your repository

### ⚠️ Important

- **Never** commit secrets to Git
- **Never** hardcode secrets in code
- **Never** share secrets publicly
- **Always** use GitHub Secrets for sensitive values

---

## 🆘 Troubleshooting

### "Secret not found" error in workflow

**Problem:** Secret name doesn't match what's in the workflow file

**Solution:** Make sure the secret name is EXACTLY `AWS_DEPLOY_ROLE_ARN` (case-sensitive)

### Workflow doesn't use the secret

**Problem:** Workflow isn't referencing the secret correctly

**Solution:** In the workflow, secrets are referenced as `${{ secrets.SECRET_NAME }}`

### Can't see secret value

**This is normal!** GitHub never shows secret values after creation. You can only update or delete them.

---

## 📋 Quick Checklist

Before pushing to trigger deployment:

- [ ] Added `AWS_DEPLOY_ROLE_ARN` secret to GitHub
- [ ] Added `LANDING_ENV_PROD` secret to GitHub (entire file contents)
- [ ] Verified secret names are exactly correct (case-sensitive)
- [ ] Verified IAM role ARN is correct: `arn:aws:iam::652821469470:role/GitHubActionsECRPushRole`
- [ ] Verified you copied the FULL contents of `env-templates/landing.env.prod` (including comments)

---

## 🎓 Understanding Build-Time vs Runtime

### Build-Time Variables (NEXT*PUBLIC*\*)

These are **baked into the JavaScript bundle** during Docker build:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_GA_TRACKING_ID`

**When to add:** Before building the Docker image (in GitHub Actions)

**Where they go:** GitHub Secrets → Used in workflow build step

### Runtime Variables

These are **read when the container starts**:

- `NODE_ENV`
- `PORT`
- Database connection strings

**When to add:** When you deploy to ECS (later)

**Where they go:** ECS Task Definition or AWS SSM Parameter Store

---

## 🔄 Adding More Secrets Later

As you add features, you'll add more secrets:

**When you add Cognito authentication:**

```bash
NEXT_PUBLIC_COGNITO_DOMAIN=https://cashsouk-prod.auth.ap-southeast-5.amazoncognito.com
NEXT_PUBLIC_COGNITO_CLIENT_ID=<your-client-id>
NEXT_PUBLIC_COGNITO_REGION=ap-southeast-5
```

**When you add analytics:**

```bash
NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX
```

**When you add error tracking:**

```bash
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

Just add them as new secrets and the next deployment will include them!
