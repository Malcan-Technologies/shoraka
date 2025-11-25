# 🚨 URGENT: Admin Container Failing - Diagnosis & Fix

## Problem
Admin deployment is rolling back due to container health check failures.

## Root Causes

### 1. Log Group Name Mismatch
**Error:** `There was an error while retrieving logs from log group: /ecs/cashsouk-admin`

**Current:** `/ecs/cashsouk-admin`
**Needed:** Check if log group exists, or create it

### 2. Potential Server Path Issue
**Current CMD:** `node apps/admin/server.js`

Next.js standalone might output to a different path.

### 3. Environment Variables at Runtime
`NEXT_PUBLIC_*` variables are baked at build time, but some might be needed at runtime.

## Immediate Diagnostic Steps

### Step 1: Check Existing Running Container
```bash
# Get the CURRENT working task (before our changes)
aws ecs list-tasks \
  --cluster default \
  --service-name admin-cashsouk-7cd8 \
  --desired-status RUNNING \
  --region ap-southeast-5

# Describe the task to see what image it's using
aws ecs describe-tasks \
  --cluster default \
  --tasks <TASK_ARN_FROM_ABOVE> \
  --region ap-southeast-5
```

### Step 2: Check CloudWatch Logs (if accessible)
```bash
# List log streams for the failed deployment
aws logs describe-log-streams \
  --log-group-name /ecs/cashsouk-admin \
  --order-by LastEventTime \
  --descending \
  --max-items 5 \
  --region ap-southeast-5

# Get recent logs
aws logs tail /ecs/cashsouk-admin \
  --follow \
  --region ap-southeast-5
```

### Step 3: Check if Log Group Exists
```bash
aws logs describe-log-groups \
  --log-group-name-prefix /ecs/ \
  --region ap-southeast-5
```

## Potential Fixes

### Fix 1: Create Missing Log Group
```bash
aws logs create-log-group \
  --log-group-name /ecs/cashsouk-admin \
  --region ap-southeast-5

# Set retention
aws logs put-retention-policy \
  --log-group-name /ecs/cashsouk-admin \
  --retention-in-days 7 \
  --region ap-southeast-5
```

### Fix 2: Verify Next.js Standalone Output

The standalone output structure should be:
```
.next/standalone/
├── apps/
│   └── admin/
│       └── server.js
├── node_modules/
└── package.json
```

So the CMD should be: `node apps/admin/server.js` ✅ (already correct)

### Fix 3: Check Build Output Locally

Build locally to verify structure:
```bash
cd /Users/ivan/Documents/Shoraka
pnpm --filter @cashsouk/admin build

# Check standalone output
ls -la apps/admin/.next/standalone/
ls -la apps/admin/.next/standalone/apps/admin/
```

### Fix 4: Add Debug Logging to Dockerfile

Temporarily add debug output:
```dockerfile
# Before CMD
RUN ls -la /app
RUN ls -la /app/apps/admin || echo "apps/admin not found"
RUN find /app -name "server.js" -type f || echo "No server.js found"

CMD ["node", "apps/admin/server.js"]
```

### Fix 5: Test Container Locally

```bash
# Build the image locally with the exact same args
docker build -f docker/portal-admin.Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.cashsouk.com \
  -t admin-test .

# Run it
docker run -p 3000:3000 admin-test

# Check if it starts
curl http://localhost:3000

# Check logs
docker logs <container-id>
```

## Most Likely Issue

Based on the symptoms, the most likely cause is:

**The Next.js app is not finding the API URL at runtime**

Even though we create `.env.production` during build, Next.js standalone might not be reading it correctly.

### Solution: Verify Environment Variables are Embedded

Check the built JavaScript:
```bash
# After building locally
grep -r "localhost:4000" apps/admin/.next/ || echo "No localhost found - good!"
grep -r "NEXT_PUBLIC_API_URL" apps/admin/.next/ | head -5
```

If you still see `localhost:4000`, the build-time env var substitution failed.

## Quick Rollback

If you need the site working immediately:
```bash
# Roll back to previous working task definition
aws ecs update-service \
  --cluster default \
  --service admin-cashsouk-7cd8 \
  --task-definition default-admin-cashsouk-7cd8:4 \
  --region ap-southeast-5
```

(Replace `:4` with whatever revision was working before)

## Next Steps

1. ✅ Check CloudWatch logs for actual error
2. ✅ Verify log group exists (create if needed)
3. ✅ Test Docker container locally
4. ✅ Verify NEXT_PUBLIC_API_URL is embedded in build
5. ✅ Check if port 3000 is correct
6. ✅ Verify health check endpoint returns 200

**ACTION REQUIRED:** Please check CloudWatch Logs in AWS Console to see the actual error message from the failed container.

