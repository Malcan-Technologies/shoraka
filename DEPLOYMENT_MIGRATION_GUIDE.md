# Database Migration Strategy - Complete Explanation

## 🎯 How Migrations Are Handled

### Development Environment

**Local Development:**
```bash
# 1. Make schema changes
# Edit: apps/api/prisma/schema.prisma

# 2. Create migration
cd apps/api
pnpm prisma migrate dev --name add_new_field

# This automatically:
# - Generates SQL migration file
# - Applies it to local database
# - Regenerates Prisma Client
```

**What happens:**
- Migration file created in `apps/api/prisma/migrations/TIMESTAMP_name/migration.sql`
- Applied to local PostgreSQL (localhost:5432)
- Git-tracked and committed with your code

---

### Production Environment (Automated)

**GitHub Actions Workflow:**

```yaml
1. Code Change Detected
   ↓
2. Build Migration Docker Image (docker/migrate.Dockerfile)
   ↓
3. Run ECS Task (one-off)
   - Acquire PostgreSQL advisory lock (pg_try_advisory_lock)
   - Run: prisma migrate deploy
   - Release lock
   ↓
4. If SUCCESS → Deploy API
   If FAIL → Stop deployment
```

**Key Components:**

#### 1. Migration Docker Image (`docker/migrate.Dockerfile`)
- Separate image just for running migrations
- Contains Prisma CLI and migration files
- No application code needed

#### 2. Advisory Lock Mechanism
```sql
-- Only ONE migration runs at a time across ALL containers
SELECT pg_try_advisory_lock(123456789);
-- Run migrations
SELECT pg_advisory_unlock(123456789);
```

**Why this matters:**
- Prevents race conditions when multiple API containers deploy
- Only first caller gets the lock
- Others wait until migrations complete
- No data corruption or schema conflicts

#### 3. ECS Run-Task
```bash
# One-off task (not a service)
aws ecs run-task \
  --task-definition cashsouk-migrate \
  --launch-type FARGATE \
  --cluster default
```

**Benefits:**
- Runs once, then exits
- GitHub Actions waits for completion
- Logs available in CloudWatch
- If fails, deployment stops

---

## 📋 Current Deployment Workflow Analysis

### Deploy.yml Workflow

**✅ FIXED Issues:**

1. **Change Detection Bug** (FIXED)
   ```yaml
   # OLD (BROKEN):
   echo "api=$(git diff ... | grep ... && echo 'true' || echo 'false')"
   # Problem: grep output included filenames, breaking GITHUB_OUTPUT
   
   # NEW (FIXED):
   if git diff ... | grep -qE '...'; then
     echo "api=true" >> $GITHUB_OUTPUT
   else
     echo "api=false" >> $GITHUB_OUTPUT
   fi
   ```

2. **SystemHealth Dev Support** (FIXED)
   ```typescript
   // Now works in both local dev and production
   const apiUrl = window.location.hostname === 'localhost'
     ? 'http://localhost:4000'
     : process.env.NEXT_PUBLIC_API_URL;
   ```

3. **Import Paths** (FIXED)
   ```typescript
   // OLD (BROKEN):
   import { Badge } from "@cashsouk/ui/badge";
   
   // NEW (FIXED):
   import { Badge } from "@cashsouk/ui";
   ```

---

### Current Workflow Flow

```
Push to main
  ↓
Check for changes (apps/api/, packages/)
  ↓
IF API changed:
  ├─ Build API image → Push to ECR
  ├─ Build migration image → Push to ECR
  ├─ Run migration ECS task (with lock)
  │   ├─ Wait for completion
  │   ├─ Check exit code
  │   └─ If fail → STOP
  └─ Deploy API to ECS (only if migration succeeded)

IF Admin changed:
  ├─ Build admin image → Push to ECR
  └─ Deploy admin to ECS

(Same for investor, issuer, landing)
```

---

## ⚠️ Remaining Issues to Address

### 1. Migration Task Definition Missing

**Problem:** The workflow references `cashsouk-migrate` task definition, but it doesn't exist yet.

**Solution:** Run this setup script:
```bash
./scripts/setup-migration-infrastructure.sh
```

**What it creates:**
- ECR repository: `cashsouk-migrate`
- ECS task definition: `cashsouk-migrate`
- CloudWatch log group: `/ecs/cashsouk-migrate`
- IAM permissions for secrets access

---

### 2. Migration Workflow Needs VPC Configuration

**Problem:** The workflow tries to get VPC config from API service, but service might not exist yet on first deployment.

**Current Code:**
```yaml
VPC_CONFIG=$(aws ecs describe-services \
  --cluster default \
  --services api-cashsouk-09ff \
  --query 'services[0].networkConfiguration.awsvpcConfiguration')
```

**Issue:** If service doesn't exist, this fails.

**Solution Options:**

**Option A:** Store VPC config in GitHub secrets (recommended)
```yaml
# Add to GitHub secrets:
# VPC_SUBNETS=subnet-xxx,subnet-yyy
# VPC_SECURITY_GROUPS=sg-xxx

--network-configuration "awsvpcConfiguration={
  subnets=[${{ secrets.VPC_SUBNETS }}],
  securityGroups=[${{ secrets.VPC_SECURITY_GROUPS }}],
  assignPublicIp=DISABLED
}"
```

**Option B:** Hardcode in workflow (simpler for now)
```yaml
# Get these from your ECS service
SUBNETS="subnet-xxx,subnet-yyy"
SECURITY_GROUPS="sg-xxx"
```

**I recommend Option A** - Let me update the workflow:

---

### 3. First Deployment Chicken-Egg Problem

**Scenario:** Fresh deployment, nothing exists yet.

**Problem:**
- Migration task needs RDS to exist
- RDS exists but migrations haven't run
- API needs migrations to be applied

**Solution:** Initial setup order:
```bash
1. Create RDS (✅ Done)
2. Run setup script locally (✅ Done - you ran it)
3. Create migration infrastructure (⚠️ Needs to be done)
4. First deployment via GitHub Actions (will work after #3)
```

---

## 🔧 Required Actions Before Next Deployment

### Action 1: Run Migration Infrastructure Setup

**If AWS CLI is configured:**
```bash
./scripts/setup-migration-infrastructure.sh
```

**If AWS CLI NOT configured:**
Manually create via AWS Console:

1. **ECR Repository:**
   - Name: `cashsouk-migrate`
   - Image scanning: Enabled
   - Encryption: AES256

2. **CloudWatch Log Group:**
   - Name: `/ecs/cashsouk-migrate`
   - Retention: 30 days

3. **ECS Task Definition:**
   - Use template: `infra/ecs-task-definition-migrate.json`
   - Register it in ECS console

---

### Action 2: Add VPC Configuration to GitHub Secrets

Get from your existing ECS service:

```bash
# Get subnet IDs
aws ecs describe-services \
  --cluster default \
  --services api-cashsouk-09ff \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets' \
  --output text

# Get security group IDs  
aws ecs describe-services \
  --cluster default \
  --services api-cashsouk-09ff \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups' \
  --output text
```

**Add to GitHub secrets:**
- `VPC_SUBNETS`: Comma-separated subnet IDs
- `VPC_SECURITY_GROUPS`: Comma-separated SG IDs

---

### Action 3: Update Workflow to Use Secrets

I'll prepare the updated workflow in the next section.

---

## ✅ Ready-to-Deploy Checklist

### Database Setup
- [x] RDS created and accessible
- [x] Master credentials in Secrets Manager
- [x] App user (`cashsouk_app`) created
- [x] Initial migrations applied locally
- [x] RDS Proxy configured

### Migration Infrastructure
- [ ] ECR repository `cashsouk-migrate` created
- [ ] CloudWatch log group created
- [ ] ECS task definition `cashsouk-migrate` registered
- [ ] IAM permissions configured

### GitHub Configuration
- [x] `AWS_DEPLOY_ROLE_ARN` secret added
- [x] `NEXT_PUBLIC_API_URL` secret added
- [ ] `VPC_SUBNETS` secret added
- [ ] `VPC_SECURITY_GROUPS` secret added

### Code Fixes
- [x] Change detection fixed (no grep output in GITHUB_OUTPUT)
- [x] SystemHealth works in dev (localhost detection)
- [x] Import paths fixed (@cashsouk/ui)
- [x] API Docker image has hoisting enabled
- [x] Health check endpoint with database test

---

## 🚀 Safe Deployment Strategy

### Phase 1: Setup (Do Now)
```bash
1. Run migration infrastructure setup
2. Add VPC secrets to GitHub
3. Commit pending changes (don't push yet)
```

### Phase 2: Test Locally (Recommended)
```bash
# Start local environment
./scripts/dev-db-setup.sh
cd apps/api && pnpm dev
cd apps/admin && pnpm dev

# Test health check
curl http://localhost:4000/healthz
# Should return: {"status":"ok","database":"connected",...}

# Test admin dashboard
# Open: http://localhost:3003
# SystemHealth card should show green status
```

### Phase 3: Deploy to Production
```bash
git push origin main

# Monitor:
# 1. GitHub Actions: https://github.com/Malcan-Technologies/shoraka/actions
# 2. CloudWatch Logs: aws logs tail /ecs/cashsouk-migrate --follow
# 3. ECS Services: AWS Console → ECS → Services
```

---

## 📊 Migration Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│  Developer: Makes Schema Change                     │
│  - Edit schema.prisma                               │
│  - Run: pnpm prisma migrate dev --name xyz          │
│  - Test locally                                     │
│  - Commit & Push                                    │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  GitHub Actions: Detect Changes                     │
│  - Check if apps/api/ or packages/ changed          │
│  - If yes → Trigger migration + API deployment      │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Build Phase                                        │
│  - Build migration image (includes Prisma + schema) │
│  - Build API image (includes app code)              │
│  - Push both to ECR                                 │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Migration Phase (ECS Task)                         │
│  1. Start task in VPC (same network as RDS)         │
│  2. Connect to database via RDS Proxy               │
│  3. Acquire advisory lock: pg_try_advisory_lock()   │
│  4. Run: prisma migrate deploy                      │
│     - Checks _prisma_migrations table               │
│     - Applies only new migrations                   │
│     - Updates migration table                       │
│  5. Release lock: pg_advisory_unlock()              │
│  6. Exit with status code (0 = success)             │
└────────────────┬────────────────────────────────────┘
                 │
                 ├─ SUCCESS → Continue
                 │
                 └─ FAILURE → STOP (API not deployed)
                 
                 ▼
┌─────────────────────────────────────────────────────┐
│  API Deployment Phase                               │
│  - Update ECS service with new image                │
│  - ECS does rolling deployment                      │
│  - Health checks verify database connection         │
│  - Old tasks drained, new tasks started             │
└─────────────────────────────────────────────────────┘
```

---

## 🛡️ Safety Mechanisms

### 1. Advisory Lock
- **Prevents:** Concurrent migrations from multiple deployments
- **How:** PostgreSQL lock (123456789 = lock ID)
- **Result:** Only one migration runs, others wait

### 2. Exit Code Check
- **Prevents:** Deploying API with failed migrations
- **How:** GitHub Actions checks task exit code
- **Result:** Deployment stops if migrations fail

### 3. Migration Table
- **Prevents:** Re-applying same migrations
- **How:** Prisma tracks in `_prisma_migrations` table
- **Result:** Only new migrations are applied

### 4. Transaction Wrapping
- **Prevents:** Partial migrations on error
- **How:** Prisma wraps each migration in transaction
- **Result:** All-or-nothing application

### 5. Idempotency
- **Prevents:** Errors if run multiple times
- **How:** Each migration checks current state
- **Result:** Safe to re-run deploy command

---

## 📝 Commit This to Memory

**Key Points:**
1. ✅ Change detection in workflow FIXED (no grep output issues)
2. ✅ SystemHealth component works in dev (localhost auto-detection)
3. ✅ Imports fixed (use @cashsouk/ui not @cashsouk/ui/badge)
4. ⚠️ Need to run `./scripts/setup-migration-infrastructure.sh` before deployment
5. ⚠️ Need to add VPC secrets to GitHub (subnets, security groups)
6. ✅ Migration strategy: Advisory lock prevents race conditions
7. ✅ Safe deployment: Migrations run BEFORE API deployment
8. ✅ Automatic rollback: If migration fails, API doesn't deploy

**Testing Workflow:**
- Local: `./scripts/dev-db-setup.sh` → Test at `http://localhost:3003`
- Production: After setup scripts, push to main triggers auto-deployment

**User should NOT push to GitHub yet** - needs to:
1. Run migration infrastructure setup
2. Add VPC secrets
3. Verify local testing works

