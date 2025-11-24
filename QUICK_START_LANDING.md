# 🚀 Quick Start: Deploy Landing Page to ECR

**Goal:** Build and push the landing page Docker image to your ECR repository `landing-cashsouk`

**Time:** 5 minutes setup + 3 minutes build

---

## ✅ Prerequisites Check

Before starting, verify you have:

- [x] ECR repository: `landing-cashsouk` ✓
- [x] IAM role: `GitHubActionsECRPushRole` ✓
- [ ] GitHub repository with this code
- [ ] GitHub secrets added (we'll do this now)

---

## 🎯 Step 1: Add GitHub Secrets (2 minutes)

### Add Secret #1: AWS Role

1. Go to GitHub: `Settings` → `Secrets and variables` → `Actions`
2. Click `New repository secret`
3. Enter:
   - **Name:** `AWS_DEPLOY_ROLE_ARN`
   - **Value:** `arn:aws:iam::652821469470:role/GitHubActionsECRPushRole`
4. Click `Add secret`

### Add Secret #2: Environment Variables

1. Click `New repository secret` again
2. Enter:
   - **Name:** `LANDING_ENV_PROD`
   - **Value:** Open `env-templates/landing.env.prod` → Select ALL → Copy → Paste here
3. Click `Add secret`

**Important:** Copy the ENTIRE file, including comments!

---

## 🚢 Step 2: Deploy (1 command)

```bash
git add .
git commit -m "Add landing page CI/CD"
git push origin main
```

---

## 👀 Step 3: Watch It Deploy

1. Go to GitHub → `Actions` tab
2. Click on "Deploy Landing Page (Test)"
3. Watch the workflow run:
   - ✅ Checkout code
   - ✅ Install dependencies
   - ✅ Create `.env.production` from secret
   - ✅ Build Next.js app
   - ✅ Build Docker image
   - ✅ Push to ECR

**Expected time:** 3-5 minutes

---

## ✅ Verify Success

### In GitHub Actions:
- Green checkmark on workflow
- No error messages
- See: "✅ Successfully pushed images"

### In AWS ECR:
1. Go to AWS Console → ECR → Repositories
2. Click `landing-cashsouk`
3. You should see:
   - Image with tag `latest`
   - Image with tag `<commit-sha>`
   - Pushed a few minutes ago

---

## 🎉 Success!

Your landing page is now:
- ✅ Built automatically on every push to `main`
- ✅ Stored in ECR as a Docker image
- ✅ Tagged with commit SHA for versioning
- ✅ Ready to deploy to ECS (next step)

---

## 🔄 How It Works

```
Push to GitHub
    ↓
GitHub Actions triggered
    ↓
Install dependencies (pnpm)
    ↓
Create .env.production from LANDING_ENV_PROD secret
    ↓
Build Next.js (pnpm --filter landing build)
    ↓
Build Docker image (docker/landing.Dockerfile)
    ↓
Authenticate with AWS (OIDC - no keys!)
    ↓
Push to ECR
    ↓
✅ Done!
```

---

## 📝 What Gets Built Into the Image

The Docker image contains:
- Built Next.js app (optimized, minified)
- Static assets
- Node.js runtime
- Environment variables (baked in at build time)
- Health check endpoint

**Image size:** ~150-200 MB (optimized with multi-stage build)

---

## 🔄 Making Changes

To update the landing page:

1. Edit files in `apps/landing/`
2. Commit and push to `main`
3. Workflow automatically rebuilds and pushes new image
4. New image tagged with new commit SHA

---

## 🛠️ Updating Environment Variables

To change environment variables:

1. Edit `env-templates/landing.env.prod`
2. Copy the ENTIRE file
3. Go to GitHub Secrets → `LANDING_ENV_PROD` → `Update`
4. Paste new contents
5. Push any change to trigger rebuild

**Note:** Environment changes require a rebuild since `NEXT_PUBLIC_*` vars are baked into the JavaScript bundle.

---

## 🆘 Troubleshooting

### Workflow fails at "Configure AWS credentials"

**Problem:** IAM role trust policy doesn't allow your GitHub repo

**Fix:**
1. AWS Console → IAM → Roles → `GitHubActionsECRPushRole`
2. Trust relationships → Edit
3. Verify `sub` condition: `repo:YOUR_USERNAME/Shoraka:ref:refs/heads/main`

### Workflow fails at "Login to Amazon ECR"

**Problem:** IAM role lacks ECR permissions

**Fix:**
1. AWS Console → IAM → Roles → `GitHubActionsECRPushRole`
2. Permissions → Add permissions
3. Add `ecr:GetAuthorizationToken` and `ecr:PutImage`

### Build fails with "Cannot find module"

**Problem:** Missing dependency

**Fix:** Run locally first:
```bash
pnpm install
pnpm --filter landing build
```

### "Repository does not exist"

**Problem:** ECR repository name mismatch

**Fix:** Verify repository is named exactly `landing-cashsouk` (not `cashsouk-landing`)

---

## 📚 Next Steps

After successful image push:

1. **Deploy to ECS** - Run the container on AWS
2. **Add ALB** - Route traffic to the container
3. **Add domain** - Point cashsouk.com to ALB
4. **Add SSL** - HTTPS certificate
5. **Add other apps** - Investor, issuer, admin, API

For now, celebrate! 🎉 Your CI/CD is working!

---

## 📊 Cost Estimate

**ECR storage:** ~$0.10/GB/month
- Landing image: ~0.2 GB
- **Cost:** ~$0.02/month

**Data transfer:** Free for first 1 GB/month

**GitHub Actions:** Free for public repos, 2000 minutes/month for private

**Total for this step:** < $0.10/month

---

## ✅ Checklist

- [ ] Added `AWS_DEPLOY_ROLE_ARN` secret
- [ ] Added `LANDING_ENV_PROD` secret (full file)
- [ ] Pushed to GitHub
- [ ] Workflow completed successfully (green checkmark)
- [ ] Verified images in ECR
- [ ] Ready for next step (ECS deployment)

**All checked?** You're ready to deploy to ECS! 🚀

