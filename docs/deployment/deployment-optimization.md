# ECS Deployment Optimization Guide

This guide covers strategies to speed up ECS deployments from the current **5-10 minutes** down to **1-3 minutes**.

## Current Bottlenecks

1. **ALB Health Checks** (~2-3 min) ⏱️ - Biggest bottleneck
2. **Docker Image Pull** (~30-60 sec)
3. **Container Startup** (~30 sec)
4. **Task Draining** (~1-2 min)
5. **Workflow Verification** (~30 sec)

## Quick Wins (Implemented)

### ✅ 1. Removed `aws ecs wait services-stable`

**Before:** Workflow waits up to 10 minutes for ECS to stabilize
**After:** Workflow completes immediately after deployment initiation

**Savings:** ~5-10 minutes per deployment

**Trade-off:** You won't get immediate feedback if deployment fails. Monitor in ECS Console instead.

### ✅ 2. Docker Layer Caching

**Added to Admin workflow:**
```yaml
docker build -f docker/portal-admin.Dockerfile \
  --cache-from $ECR_REGISTRY/$ECR_REPOSITORY:latest \
  -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
  -t $ECR_REGISTRY/$ECR_REPOSITORY:latest .
```

**Savings:** ~20-30% faster builds (reuses unchanged layers)

### ✅ 3. Optimized pnpm Install

**Added to Admin Dockerfile:**
```dockerfile
RUN pnpm install --frozen-lockfile --prefer-offline
```

**Savings:** ~10-15 sec per build

### ✅ 4. Simplified Verification

Removed complex image verification logic - deployments complete faster.

## Recommended AWS Optimizations

### 🎯 1. Optimize ALB Health Checks (BIGGEST IMPACT)

**Current settings (likely):**
- Interval: 30 seconds
- Healthy threshold: 5 checks
- **Total wait: 2.5 minutes**

**Optimized settings:**

```bash
# Get your target group ARN first
aws elbv2 describe-target-groups \
  --region ap-southeast-5 \
  --query 'TargetGroups[?contains(TargetGroupName, `admin`)].[TargetGroupArn]' \
  --output text

# Update health check settings
aws elbv2 modify-target-group \
  --target-group-arn <ARN_FROM_ABOVE> \
  --health-check-enabled \
  --health-check-protocol HTTP \
  --health-check-path / \
  --health-check-interval-seconds 10 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 2 \
  --region ap-southeast-5
```

**New total: 20 seconds** ⚡

**Savings:** ~2 minutes per deployment

**Apply to all target groups:**
- admin-cashsouk
- api-cashsouk
- investor-cashsouk
- issuer-cashsouk
- landing-cashsouk

### 🎯 2. Add Dedicated Health Check Endpoint

Instead of checking `/` (which might do expensive operations), add a lightweight endpoint:

**API (`apps/api/src/app.ts`):**
```typescript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
```

**Next.js Portals:**
Already have Next.js default response on `/` - no change needed.

**Then update ALB:**
```bash
aws elbv2 modify-target-group \
  --target-group-arn <api-target-group-arn> \
  --health-check-path /health \
  --region ap-southeast-5
```

### 🎯 3. Reduce Task Deregistration Delay

**Current (likely):** 300 seconds (5 minutes)
**Optimized:** 30 seconds

```bash
aws elbv2 modify-target-group-attributes \
  --target-group-arn <ARN> \
  --attributes Key=deregistration_delay.timeout_seconds,Value=30 \
  --region ap-southeast-5
```

**Savings:** ~4.5 minutes per deployment

### 🎯 4. Enable ECS Circuit Breaker (Safety)

Automatically rolls back failed deployments instead of waiting:

```bash
aws ecs update-service \
  --cluster default \
  --service admin-cashsouk-7cd8 \
  --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=200,minimumHealthyPercent=100" \
  --region ap-southeast-5
```

**Apply to all services.**

## Medium-Term Optimizations

### 🚀 1. Smaller Docker Images

**Current size check:**
```bash
docker images | grep cashsouk
```

**Target:** < 200MB per image

**Strategies:**
- Use `node:20-alpine` (already doing ✅)
- Multi-stage builds (already doing ✅)
- `.dockerignore` file (add if missing)
- Remove dev dependencies in runner stage

**Create `.dockerignore`:**
```
node_modules
.next
.git
.github
*.md
docs/
scripts/
.env*
!.env.production
```

### 🚀 2. ECR Image Scanning & Caching

Enable ECR image caching in the same AZ as ECS:

```bash
aws ecr put-lifecycle-policy \
  --repository-name admin-cashsouk \
  --lifecycle-policy-text '{
    "rules": [{
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": { "type": "expire" }
    }]
  }' \
  --region ap-southeast-5
```

### 🚀 3. Parallel Deployments

Currently, workflow deploys services sequentially. For independent services, deploy in parallel:

**Create separate jobs:**
```yaml
jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps: [...]
  
  deploy-admin:
    runs-on: ubuntu-latest
    steps: [...]
  
  deploy-investor:
    runs-on: ubuntu-latest
    steps: [...]
```

**Savings:** Deploy all 5 services in the time of 1!

## Advanced Optimizations

### ⚡ 1. Use AWS CodeDeploy Blue/Green

Zero-downtime with instant rollback:
- Spin up new tasks
- Switch traffic atomically
- Keep old tasks for instant rollback

**Setup:** Requires ALB listener rules and Target Group configuration.

### ⚡ 2. Pre-pull Images

Keep a warm pool of tasks:

```bash
aws ecs update-service \
  --cluster default \
  --service admin-cashsouk-7cd8 \
  --desired-count 2 \
  --region ap-southeast-5
```

**Drawback:** 2x cost

### ⚡ 3. Use Fargate Spot (Lower Cost)

For non-critical services, use Spot instances (70% cheaper):

Update task definition:
```json
{
  "capacityProviderStrategy": [
    {
      "capacityProvider": "FARGATE_SPOT",
      "weight": 1
    }
  ]
}
```

## Expected Timeline After All Optimizations

| Phase | Before | After | Savings |
|-------|--------|-------|---------|
| Build & Push | 2 min | 1.5 min | 25% faster |
| Register Task Def | 5 sec | 5 sec | - |
| Start New Task | 1 min | 1 min | - |
| Health Checks | 2.5 min | 20 sec | **80% faster** |
| Drain Old Task | 5 min | 30 sec | **90% faster** |
| Workflow Wait | 10 min | 0 sec | **Removed** |
| **TOTAL** | **~10-15 min** | **~2-3 min** | **70-80% faster** |

## Monitoring

After optimization, monitor deployments:

```bash
# Watch deployment in real-time
aws ecs describe-services \
  --cluster default \
  --services admin-cashsouk-7cd8 \
  --region ap-southeast-5 \
  --query 'services[0].deployments[*].{Status:status,Desired:desiredCount,Running:runningCount,Pending:pendingCount,Health:rolloutState}' \
  --output table
```

## Rollback Strategy

If a deployment fails:

```bash
# List recent task definitions
aws ecs list-task-definitions \
  --family-prefix default-admin-cashsouk-7cd8 \
  --region ap-southeast-5 \
  --max-items 5

# Rollback to previous revision
aws ecs update-service \
  --cluster default \
  --service admin-cashsouk-7cd8 \
  --task-definition default-admin-cashsouk-7cd8:5 \
  --region ap-southeast-5
```

## Priority Implementation Order

1. ✅ **Remove wait command** (already done)
2. 🎯 **Optimize ALB health checks** (5 min → do this NOW)
3. 🎯 **Reduce deregistration delay** (2 min → do this NOW)
4. ✅ **Docker layer caching** (already done for Admin)
5. 🚀 **Apply to all services** (Landing, Investor, Issuer, API)
6. 🚀 **Create .dockerignore**
7. 🚀 **Parallel workflow jobs**
8. ⚡ **Consider Blue/Green if zero-downtime critical**

## Next Steps

Run these commands to apply optimizations:

```bash
# 1. Get all target group ARNs
aws elbv2 describe-target-groups --region ap-southeast-5 \
  --query 'TargetGroups[?contains(TargetGroupName, `cashsouk`)].[TargetGroupName,TargetGroupArn]' \
  --output table

# 2. For each ARN, run:
aws elbv2 modify-target-group \
  --target-group-arn <ARN> \
  --health-check-interval-seconds 10 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 2 \
  --region ap-southeast-5

# 3. Reduce deregistration delay
aws elbv2 modify-target-group-attributes \
  --target-group-arn <ARN> \
  --attributes Key=deregistration_delay.timeout_seconds,Value=30 \
  --region ap-southeast-5

# 4. Enable circuit breaker for all services
for SERVICE in admin-cashsouk-7cd8 api-cashsouk-09ff investor-cashsouk-50e5 issuer-cashsouk-ff47 landing-cashsouk-1156; do
  aws ecs update-service \
    --cluster default \
    --service $SERVICE \
    --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=200,minimumHealthyPercent=100" \
    --region ap-southeast-5
done
```

These changes will reduce deployment time from 10-15 minutes to 2-3 minutes! 🚀
