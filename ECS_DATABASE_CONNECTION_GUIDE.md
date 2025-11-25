# ECS API Database Connection Guide

This guide shows you how to connect your ECS API container to RDS and verify the connection.

---

## 🎯 Overview

Your setup:
- **ECS Service:** `api-cashsouk-09ff` on cluster `default`
- **RDS Database:** `cashsouk-prod-db` (PostgreSQL 17.6)
- **RDS Proxy:** `cashsouk-prod-proxy` (for connection pooling)
- **Secrets:** `rds!db-71798d0b-adc4-4acb-a5e7-0a3275e77182` (master credentials)

**Connection Flow:**
```
ECS Task → RDS Proxy → RDS Database
```

Using the proxy provides:
- ✅ Connection pooling (prevents connection exhaustion)
- ✅ Automatic failover
- ✅ Better performance under load

---

## 📋 Prerequisites

1. **AWS CLI configured** with credentials
   ```bash
   aws configure
   ```

2. **API code updated** with database connection logic (✅ Done)
   - DATABASE_URL constructed from env vars
   - Health check tests database connection

3. **Latest API image pushed to ECR**
   ```bash
   # This will happen automatically on next git push
   # Or build manually:
   docker build -f docker/api.Dockerfile -t 652821469470.dkr.ecr.ap-southeast-5.amazonaws.com/api-cashsouk:latest .
   docker push 652821469470.dkr.ecr.ap-southeast-5.amazonaws.com/api-cashsouk:latest
   ```

---

## 🚀 Setup Steps

### Step 1: Update Secret to Use Proxy

The RDS Proxy endpoint needs to be in your secret:

```bash
# Run the automated setup script
./scripts/setup-ecs-api-database.sh
```

**This script will:**
1. ✅ Update secret with RDS Proxy endpoint
2. ✅ Create CloudWatch log group
3. ✅ Update IAM permissions
4. ✅ Register ECS task definition
5. ✅ Update ECS service (if exists)

---

### Step 2: Verify Secret Configuration

Check that the secret has the proxy endpoint:

```bash
aws secretsmanager get-secret-value \
  --secret-id rds!db-71798d0b-adc4-4acb-a5e7-0a3275e77182 \
  --region ap-southeast-5 \
  --query SecretString \
  --output text | jq '.'
```

**Should show:**
```json
{
  "username": "cashsouk_admin",
  "password": "O|u*d)HN9?0UL8h$9Z7p01JlQ?L|",
  "engine": "postgres",
  "host": "cashsouk-prod-proxy.proxy-c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com",
  "port": 5432,
  "dbname": "cashsouk"
}
```

**If `host` still shows the direct RDS endpoint**, update it manually:

AWS Console → Secrets Manager → Your Secret → Retrieve secret value → Edit

Change `host` to:
```
cashsouk-prod-proxy.proxy-c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com
```

---

### Step 3: Deploy Updated API

**Option A: Via GitHub Actions (Recommended)**

```bash
# Commit the API changes
git add apps/api/src/
git commit -m "feat(api): add database connection and health check"
git push origin main

# GitHub Actions will:
# - Build new API image
# - Run migrations
# - Deploy to ECS
```

**Option B: Manual Deployment**

```bash
# Build and push image
docker build -f docker/api.Dockerfile \
  -t 652821469470.dkr.ecr.ap-southeast-5.amazonaws.com/api-cashsouk:$(git rev-parse HEAD) .

aws ecr get-login-password --region ap-southeast-5 | \
  docker login --username AWS --password-stdin 652821469470.dkr.ecr.ap-southeast-5.amazonaws.com

docker push 652821469470.dkr.ecr.ap-southeast-5.amazonaws.com/api-cashsouk:$(git rev-parse HEAD)

# Update ECS service
aws ecs update-service \
  --cluster default \
  --service api-cashsouk-09ff \
  --force-new-deployment \
  --region ap-southeast-5
```

---

## 🧪 Testing the Connection

### Test 1: Health Check Endpoint

Get your API endpoint (from ALB or ECS service), then:

```bash
# If you have an ALB
curl https://api.cashsouk.com/healthz

# Or get the ECS task public IP (if assigned)
TASK_ARN=$(aws ecs list-tasks \
  --cluster default \
  --service-name api-cashsouk-09ff \
  --region ap-southeast-5 \
  --query 'taskArns[0]' \
  --output text)

TASK_IP=$(aws ecs describe-tasks \
  --cluster default \
  --tasks $TASK_ARN \
  --region ap-southeast-5 \
  --query 'tasks[0].containers[0].networkInterfaces[0].privateIpv4Address' \
  --output text)

# From within VPC or via bastion:
curl http://$TASK_IP:4000/healthz
```

**Expected response:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2025-11-25T..."
}
```

**If you get an error:**
```json
{
  "status": "error",
  "database": "disconnected",
  "error": "...",
  "timestamp": "2025-11-25T..."
}
```

Check the error message and CloudWatch logs (see below).

---

### Test 2: Check CloudWatch Logs

View real-time logs:

```bash
# Follow logs
aws logs tail /ecs/cashsouk-api --follow --region ap-southeast-5

# Or view last 10 minutes
aws logs tail /ecs/cashsouk-api --since 10m --region ap-southeast-5
```

**Look for:**
- ✅ `📊 Database URL constructed from environment variables`
- ✅ `🔌 Connecting to: cashsouk-prod-proxy.proxy-...`
- ✅ `🚀 API server running on http://localhost:4000`

**Errors to watch for:**
- ❌ `Can't reach database server` → Network/Security group issue
- ❌ `password authentication failed` → Wrong credentials
- ❌ `getaddrinfo ENOTFOUND` → Wrong host in secret

---

### Test 3: Verify Database Connection from ECS Task

Execute a command inside the running container:

```bash
# Get running task ARN
TASK_ARN=$(aws ecs list-tasks \
  --cluster default \
  --service-name api-cashsouk-09ff \
  --region ap-southeast-5 \
  --query 'taskArns[0]' \
  --output text)

# Connect to container (requires Session Manager plugin)
aws ecs execute-command \
  --cluster default \
  --task $TASK_ARN \
  --container api \
  --interactive \
  --command "/bin/sh" \
  --region ap-southeast-5

# Inside container, test database connection:
node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.\$connect().then(() => console.log('Connected!')).catch(console.error)"
```

---

## 🔍 Troubleshooting

### Issue 1: "Can't reach database server"

**Cause:** Security group not allowing ECS → RDS traffic

**Fix:**
1. Go to AWS Console → EC2 → Security Groups
2. Find your RDS security group (likely `cashsouk-rds-sg`)
3. Add inbound rule:
   - **Type:** PostgreSQL
   - **Port:** 5432
   - **Source:** Security group of your ECS tasks (e.g., `sg-xxxxx`)

### Issue 2: "password authentication failed"

**Cause:** Wrong credentials in secret

**Fix:**
1. Verify secret contents (see Step 2 above)
2. Ensure username is `cashsouk_admin`
3. Ensure password matches what AWS generated

### Issue 3: Database connects but queries fail

**Cause:** User doesn't have permissions

**Fix:**
Since you're using master user, this shouldn't happen. But verify:

```sql
-- Connect via DBeaver or psql
\du  -- List users and their permissions
```

### Issue 4: Connection works from local but not ECS

**Cause:** Network configuration

**Check:**
1. ECS tasks are in the same VPC as RDS
2. Subnets have route to RDS subnets
3. Network ACLs allow traffic
4. RDS Proxy is in the same VPC

---

## 📊 Monitoring

### CloudWatch Metrics to Watch

1. **Database Connections:**
   - RDS → Metrics → DatabaseConnections
   - Should stay low with proxy pooling

2. **ECS Task Health:**
   - ECS → Clusters → default → Services → api-cashsouk-09ff → Health

3. **Application Logs:**
   - CloudWatch → Log Groups → /ecs/cashsouk-api

### Set Up Alarms

```bash
# Example: Alert if API tasks go to 0
aws cloudwatch put-metric-alarm \
  --alarm-name cashsouk-api-no-tasks \
  --alarm-description "Alert when API has no running tasks" \
  --metric-name RunningTasksCount \
  --namespace AWS/ECS \
  --statistic Average \
  --period 60 \
  --threshold 1 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=ServiceName,Value=api-cashsouk-09ff Name=ClusterName,Value=default \
  --region ap-southeast-5
```

---

## ✅ Success Checklist

- [ ] Secret contains RDS Proxy endpoint
- [ ] ECS task definition references correct secret ARN
- [ ] IAM roles have Secrets Manager permissions
- [ ] Security groups allow ECS → RDS traffic
- [ ] Latest API image deployed to ECS
- [ ] Health check returns `"database": "connected"`
- [ ] CloudWatch logs show successful database connection
- [ ] Can query database from API

---

## 🎉 Next Steps

Once your API is connected to the database:

1. **Disable RDS public access** (important for security!)
   - AWS Console → RDS → Modify → Public access: No

2. **Test your API endpoints:**
   ```bash
   curl -X POST https://api.cashsouk.com/v1/auth/sync-user \
     -H "Content-Type: application/json" \
     -d '{"cognitoSub": "test", "email": "test@example.com", "roles": ["INVESTOR"]}'
   ```

3. **Monitor for a few hours** to ensure stability

4. **Deploy frontend portals** that will call your API

---

## 📝 Reference

**Endpoints:**
- RDS Direct: `cashsouk-prod-db.c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com:5432`
- RDS Proxy: `cashsouk-prod-proxy.proxy-c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com:5432`

**ARNs:**
- Secrets: `arn:aws:secretsmanager:ap-southeast-5:652821469470:secret:rds!db-71798d0b-adc4-4acb-a5e7-0a3275e77182-ggp48I`
- RDS Proxy: `arn:aws:rds:ap-southeast-5:652821469470:db-proxy:prx-064c7ebffd7849ad2`

**Resources:**
- Task Definition: `infra/ecs-task-definition-api.json`
- Setup Script: `scripts/setup-ecs-api-database.sh`
- CloudWatch Logs: `/ecs/cashsouk-api`

