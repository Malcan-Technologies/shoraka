# GitHub Actions Workflow Status

## ✅ Active Workflows

### `deploy-landing-test.yml` - Landing Page Only (ACTIVE)

**Status:** ✅ **ENABLED** - This workflow runs automatically

**Triggers:**
- Push to `main` branch that changes:
  - `apps/landing/**`
  - `packages/**`
  - `.github/workflows/deploy-landing-test.yml`
- Manual trigger from GitHub Actions UI

**What it does:**
1. Builds the landing page Next.js app
2. Creates Docker image
3. Pushes to ECR: `landing-cashsouk`

**Secrets required:**
- `AWS_DEPLOY_ROLE_ARN`
- `LANDING_ENV_PROD`

---

## 🚫 Disabled Workflows

### `deploy.yml` - Full Platform Deployment (DISABLED)

**Status:** 🚫 **DISABLED** - Will NOT run automatically

**Why disabled:**
- Tries to deploy ALL services (API, landing, investor, issuer, admin)
- You don't have all the ECR repositories yet
- You don't have ECS services set up yet
- Only needed when you're ready for full deployment

**Can still trigger manually** from GitHub Actions UI if needed.

**To enable later:**
1. Edit `.github/workflows/deploy.yml`
2. Uncomment the `push:` trigger under `on:`
3. Set up all required AWS resources first

---

## 🎯 Current Setup

**For testing CI/CD with just the landing page:**
- ✅ Use `deploy-landing-test.yml`
- ✅ Pushes to ECR repository: `landing-cashsouk`
- ✅ No ECS deployment (just builds and stores image)

**When ready for full deployment:**
- Enable `deploy.yml`
- Set up ECS cluster, services, ALB, etc.
- Use complete AWS infrastructure

---

## 📊 Workflow Comparison

| Feature | deploy-landing-test.yml | deploy.yml |
|---------|------------------------|------------|
| **Status** | ✅ Active | 🚫 Disabled |
| **Services** | Landing only | All 5 services |
| **Build** | ✅ Yes | ✅ Yes |
| **Push to ECR** | ✅ Yes | ✅ Yes |
| **Deploy to ECS** | ❌ No | ✅ Yes (when enabled) |
| **Run migrations** | ❌ No | ✅ Yes (when enabled) |
| **Required repos** | 1 (landing-cashsouk) | 5 (all services) |

---

## 🔧 Current Deployment Flow

```
Push to main
    ↓
deploy-landing-test.yml triggers
    ↓
Build landing page
    ↓
Push to ECR (landing-cashsouk)
    ↓
✅ Done!
(Image stored, ready to deploy to ECS later)
```

---

## 🚀 Next Steps

After you have the landing image in ECR, you can:

1. **Manual ECS deployment** - Create ECS service and run the container
2. **Add ALB** - Route traffic to the container
3. **Add domain** - Point to your ALB
4. **Enable auto-deploy** - Add ECS update steps to the workflow
5. **Add other services** - Create ECR repos and workflows for API, etc.

---

## ✅ Summary

**Right now:**
- Only `deploy-landing-test.yml` is active
- It only builds and pushes landing page to ECR
- No automatic ECS deployment yet
- No other services deployed

**This is perfect for testing!** You get:
- ✅ CI/CD working
- ✅ Images in ECR
- ✅ No complex infrastructure needed yet
- ✅ Can manually deploy to ECS when ready

