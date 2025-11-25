# ECS Deployment Optimization Guide

## Current Deployment Time Analysis

**Issue:** ECS tasks are slow to start after pushing images to ECR

**Typical ECS deployment takes 8-12 minutes due to:**

1. 🐌 ECR image pull (~2-4 min) - Large image size
2. 🐌 Task provisioning & ENI attachment (~1-2 min)
3. 🐌 Application startup & Prisma generation (~1-2 min)
4. 🐌 Health check grace period (~2-5 min) - Service waits before routing traffic
5. 🐌 Deployment strategy (rolling updates) (~2-3 min)

---

## 🚀 **ECS-Specific Optimization Strategies**

### 1. Reduce Docker Image Size (50% faster ECR pull)

**Current issue:** Large images take 2-4 minutes to pull from ECR

**Check your current image sizes:**

```bash
aws ecr describe-images \
  --repository-name api-cashsouk \
  --region ap-southeast-5 \
  --query 'sort_by(imageDetails,& imagePushedAt)[-1].imageSizeInBytes'
```

#### Optimization tactics:

**A. Multi-stage builds (already done ✅)**
Your Dockerfiles already use multi-stage builds.

**B. Reduce Prisma binary bloat:**

```dockerfile
# In api.Dockerfile, after prisma generate:
RUN find node_modules/.prisma -name "*.node" -type f -not -name "*linux-musl*.node" -delete
RUN find node_modules/@prisma -name "*.node.tmp" -delete
```

**C. Remove dev dependencies:**

```dockerfile
RUN pnpm install --frozen-lockfile --prod
# Don't install devDependencies in runner stage
```

**D. Better .dockerignore:**

```
# Add to .dockerignore
node_modules
.git
.github
**/*.md
**/test
**/*.test.ts
dist
.turbo
.next/cache
```

**Expected improvement:** 40-60% smaller images = 1-2 minutes faster pull

---

### 2. Use ECR Image Cache (Instant pulls for unchanged layers)

Enable **ECR image scanning** and use the same image tag for identical builds:

**Current:** Every commit creates a new image, even if code didn't change
**Optimized:** Reuse images when possible

```bash
# In GitHub Actions, check if image exists:
IMAGE_EXISTS=$(aws ecr describe-images \
  --repository-name api-cashsouk \
  --image-ids imageTag=$COMMIT_SHA \
  --region ap-southeast-5 2>/dev/null || echo "")

if [ -n "$IMAGE_EXISTS" ]; then
  echo "Image already exists, skipping build"
else
  docker build ...
fi
```

**Expected improvement:** Skip entire build/push when no changes

---

### 3. ECS Service Configuration (2-3 min faster deployments)

**Update your ECS services with optimal settings:**

Go to **ECS Console** → **Clusters** → **default** → Click each service → **Update service**:

#### A. Deployment Configuration:

- **Minimum healthy percent:** 100
- **Maximum percent:** 200 (allows new tasks to start before old ones stop)
- **Enable deployment circuit breaker:** ✅
- **Enable rollback on failure:** ✅

#### B. Health Check Grace Period:

- **Set to 60 seconds** (your apps start quickly!)
- Default is often 300 seconds (5 min) - way too long

```bash
# Via AWS CLI:
aws ecs update-service \
  --cluster default \
  --service api-cashsouk-09ff \
  --health-check-grace-period-seconds 60 \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100,deploymentCircuitBreaker={enable=true,rollback=true}" \
  --region ap-southeast-5
```

**Expected improvement:** 2-4 minutes faster per service

---

### 4. Increase ECS Task Resources (Faster startup)

**Current:** CPU=512, Memory=1024
**Issue:** Slow Prisma generation and app startup

**Recommended for API:**

- CPU: 1024 (1 vCPU)
- Memory: 2048 MB

**Update task definition:**

```json
{
  "cpu": "1024",
  "memory": "2048"
}
```

**For portals (Next.js):**

- CPU: 512 (sufficient)
- Memory: 1024 MB (sufficient)

**Expected improvement:** 30-60 seconds faster startup

---

### 5. ECR VPC Endpoint (Faster image pulls)

**Current:** Tasks pull images from ECR over the internet (slower)
**Optimized:** Use VPC endpoint for ECR (private, faster)

**Setup:**

1. Go to **VPC Console** → **Endpoints** → **Create endpoint**
2. Service: `com.amazonaws.ap-southeast-5.ecr.dkr`
3. VPC: Your ECS VPC
4. Subnets: Same as ECS tasks
5. Security group: Allow HTTPS from ECS tasks
6. Repeat for `com.amazonaws.ap-southeast-5.ecr.api` and `com.amazonaws.ap-southeast-5.s3` (ECR uses S3 for layers)

**Expected improvement:** 30-50% faster ECR pulls (30-90 seconds)

---

### 6. Pre-generate Prisma Client (Faster container startup)

**Current issue:** Prisma generates client on first use, slowing startup

**Fix:** Ensure `prisma generate` runs during Docker build (already done ✅)

**Verify in logs:**

```bash
aws logs tail /ecs/cashsouk-api --since 5m --region ap-southeast-5 | grep -i prisma
```

You should NOT see "Prisma schema loaded" during container startup.

---

### 7. Optimize Deployment Strategy

**Rolling deployment optimization:**

Instead of waiting for all tasks to be healthy, use:

- **Deployment batching:** Update 50% of tasks at a time
- **Faster rollout:** Reduce `deregistrationDelay` on target groups

**Update target group:**

```bash
aws elbv2 modify-target-group-attributes \
  --target-group-arn <your-target-group-arn> \
  --attributes Key=deregistration_delay.timeout_seconds,Value=30 \
  --region ap-southeast-5
```

**Expected improvement:** 1-2 minutes per service

---

### 8. Use Fargate Spot (Optional, for dev/staging)

**For non-production environments:**

Fargate Spot is 70% cheaper and provisions faster in some cases.

**Not recommended for production** due to potential interruptions.

---

### 9. Docker Layer Caching (GitHub Actions optimization)

While your main issue is ECS, faster builds mean faster deploys overall.

**See Phase 1 section for GitHub Actions optimizations.**

---

## 🎯 **Recommended Quick Wins (30 min implementation)**

### Immediate Actions (via AWS Console):

1. **Update ECS service health check grace period to 60s**
   - Go to each service → Update → Health check grace period = 60
   - **Saves: 2-4 minutes per service**

2. **Update target group deregistration delay to 30s**
   - Go to EC2 → Target Groups → Your TGs → Attributes → Set to 30s
   - **Saves: 1-2 minutes per service**

3. **Set ECS deployment config to max=200%, min=100%**
   - Already might be set, but verify
   - **Saves: 1-2 minutes per service**

**Total expected savings: 4-8 minutes** 🎉

---

## 🛠️ **Medium-Term Improvements (2-3 hours)**

4. **Optimize Docker images** (reduce size by 40-60%)
   - Better .dockerignore
   - Remove Prisma unused binaries
   - Production-only dependencies

5. **Create VPC endpoints for ECR**
   - Faster, more reliable image pulls
   - **Saves: 30-90 seconds per deployment**

6. **Increase API task CPU to 1024**
   - Faster Prisma operations
   - **Saves: 30-60 seconds**

**Total additional savings: 2-4 minutes**

---

## 📊 **Expected Results**

**Current ECS deployment:** ~10 minutes
**After quick wins:** ~6 minutes (40% faster) ⚡
**After medium-term:** ~4 minutes (60% faster) ⚡⚡

---

## 🔍 **How to Measure Current Deployment Time**

Check your actual deployment time:

```bash
# Get recent service deployments
aws ecs describe-services \
  --cluster default \
  --services api-cashsouk-09ff \
  --region ap-southeast-5 \
  --query 'services[0].deployments[0]'
```

Look at the deployment events in CloudWatch or ECS Console to see where time is spent.

---

## ✅ **Action Items for You**

1. ✅ **Update all ECS services health check grace period to 60s** (do this NOW!)
2. ✅ **Update target group deregistration delay to 30s**
3. ✅ **Verify deployment configuration (max=200%, min=100%)**
4. Optimize Dockerfiles (add .dockerignore improvements)
5. Consider VPC endpoints for ECR (if budget allows)

**Want me to show you exactly how to do steps 1-3 in AWS Console?**

**Current:** Every build starts from scratch
**Optimized:** Reuse unchanged layers

#### Implementation:

Add to each build step in GitHub Actions:

```yaml
- name: Build API with cache
  uses: docker/build-push-action@v5
  with:
    context: .
    file: docker/api.Dockerfile
    push: true
    tags: ${{ steps.login-ecr.outputs.registry }}/api-cashsouk:${{ github.sha }}
    cache-from: type=registry,ref=${{ steps.login-ecr.outputs.registry }}/api-cashsouk:cache
    cache-to: type=registry,ref=${{ steps.login-ecr.outputs.registry }}/api-cashsouk:cache,mode=max
```

**Expected improvement:** 3-5 minutes saved per build

---

### 2. Multi-Stage Build Optimization

**Current Dockerfile structure:**

```dockerfile
FROM node:20-alpine AS builder
# Install everything
# Build everything
FROM node:20-alpine AS runner
# Copy everything
```

**Optimized:**

```dockerfile
FROM node:20-alpine AS deps
# Only install dependencies (cached unless package.json changes)

FROM node:20-alpine AS builder
COPY --from=deps /app/node_modules ./node_modules
# Build (cached unless source changes)

FROM node:20-alpine AS runner
# Minimal runtime
```

**Expected improvement:** 2-3 minutes saved

---

### 3. pnpm Store Caching

Add GitHub Actions cache for pnpm:

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 9

- name: Get pnpm store directory
  id: pnpm-cache
  run: echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT

- name: Setup pnpm cache
  uses: actions/cache@v4
  with:
    path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-
```

**Expected improvement:** 1-2 minutes saved

---

### 4. Parallel Builds (50% faster for multi-service deployments)

**Current:** Services build sequentially
**Optimized:** Build all images in parallel, then deploy

```yaml
- name: Build all images in parallel
  run: |
    docker build -f docker/api.Dockerfile -t $ECR_REGISTRY/api-cashsouk:$IMAGE_TAG . &
    docker build -f docker/landing.Dockerfile -t $ECR_REGISTRY/landing-cashsouk:$IMAGE_TAG . &
    docker build -f docker/portal-investor.Dockerfile -t $ECR_REGISTRY/investor-cashsouk:$IMAGE_TAG . &
    # ... other services
    wait  # Wait for all parallel builds to complete
```

**Expected improvement:** 4-6 minutes saved (when deploying multiple services)

---

### 5. Smaller Base Images

**Current:** `node:20-alpine` (~170MB)
**Optimized:** `node:20-alpine` is already good, but consider:

- Remove dev dependencies in production
- Use `.dockerignore` to exclude unnecessary files

**Expected improvement:** Faster push/pull times (30-60 seconds)

---

### 6. ECS Task Deployment Settings

Update ECS service settings for faster rollouts:

```json
{
  "deploymentConfiguration": {
    "maximumPercent": 200,
    "minimumHealthyPercent": 100,
    "deploymentCircuitBreaker": {
      "enable": true,
      "rollback": true
    }
  },
  "healthCheckGracePeriodSeconds": 60 // Reduce from default 300
}
```

**Expected improvement:** 1-2 minutes per service

---

### 7. Skip Unchanged Services

**Current:** Already implemented! ✅
Your workflow only deploys services with code changes.

Keep this! It's saving you 5-10 minutes when only one service changes.

---

### 8. Pre-built Base Images

Create custom base images with common dependencies:

```dockerfile
# Custom base image (build once per month)
FROM node:20-alpine
RUN apk add --no-cache openssl postgresql-client
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
# Cache common node_modules
```

Push to ECR as `cashsouk-node-base:latest`

**Expected improvement:** 1-2 minutes per build

---

### 9. GitHub Actions Runner Optimization

**Current:** GitHub-hosted runners
**Consider:** Self-hosted runners with:

- More CPU/memory (faster builds)
- Persistent Docker layer cache
- Located in same AWS region as ECR (faster push/pull)

**Expected improvement:** 3-5 minutes (requires infrastructure setup)

---

### 10. Reduce Docker Image Sizes

**Next.js optimization:**

```dockerfile
# Use standalone output (already done ✅)
output: 'standalone'

# Remove source maps in production
productionBrowserSourceMaps: false
```

**API optimization:**

```dockerfile
# Remove Prisma dev binaries
RUN pnpm prisma generate
RUN rm -rf node_modules/.prisma/client/*.node.tmp
```

**Expected improvement:** 30-60 seconds per service

---

## 🎯 **Recommended Implementation Order**

### Phase 1: Quick Wins (1 hour implementation)

1. ✅ Add Docker Buildx setup (already added)
2. Add Docker layer caching (use `docker/build-push-action@v5`)
3. Add pnpm store caching
4. Reduce ECS health check grace period to 60s

**Expected total savings:** 5-8 minutes

### Phase 2: Medium Effort (2-3 hours)

5. Optimize Dockerfiles (better layer separation)
6. Parallel builds for multi-service deploys
7. Create custom base images

**Expected total savings:** 8-12 minutes

### Phase 3: Advanced (Optional, 1 day)

8. Self-hosted GitHub Actions runners in AWS
9. Advanced caching strategies

**Expected total savings:** 10-15 minutes

---

## 📊 **Expected Results**

**Current deployment time:** ~12 minutes (single service with changes)
**After Phase 1:** ~7 minutes (40% faster)
**After Phase 2:** ~4 minutes (67% faster)
**After Phase 3:** ~2 minutes (83% faster)

---

## 🔍 **Monitoring Deployment Performance**

Add timing to your workflow:

```yaml
- name: Record build start time
  id: build-start
  run: echo "time=$(date +%s)" >> $GITHUB_OUTPUT

- name: Build images
  # ... build steps

- name: Record build end time
  run: |
    START=${{ steps.build-start.outputs.time }}
    END=$(date +%s)
    DURATION=$((END - START))
    echo "Build took ${DURATION} seconds"
```

---

## 🛠️ **Next Steps**

1. Review this guide with your team
2. Implement Phase 1 optimizations
3. Measure improvements
4. Decide if Phase 2/3 are worth the effort for your team

**Want me to implement Phase 1 optimizations now?** Let me know and I'll update your workflows!
