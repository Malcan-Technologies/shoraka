# Deployment Guide

Complete guide for deploying CashSouk to AWS ECS Fargate with automated CI/CD.

## Architecture Overview

```
Internet
   ↓
CloudFront + WAF
   ↓
Application Load Balancer
   ├─ cashsouk.com → Landing
   ├─ investor.cashsouk.com → Investor Portal
   ├─ issuer.cashsouk.com → Issuer Portal
   ├─ admin.cashsouk.com → Admin Portal
   └─ api.cashsouk.com → API
   ↓
ECS Fargate (5 services)
   ↓
RDS Proxy → RDS PostgreSQL
```

**See [AWS Infrastructure](../architecture/aws-infrastructure.md) for detailed architecture.**

## Quick Start

### Prerequisites

- AWS Account with admin access
- AWS CLI v2 configured
- Docker installed
- GitHub repository
- Domain registered in Route 53

### 1. AWS Infrastructure Setup

Follow the comprehensive setup guide:

📁 **[infra/README.md](../../infra/README.md)** - Step-by-step AWS resource creation

This includes:
- VPC and networking
- ALB and target groups
- ECS cluster
- RDS PostgreSQL
- S3, CloudFront, Cognito
- IAM roles
- SSM parameters

### 2. Create ECR Repositories

```bash
./scripts/setup-aws.sh
```

This creates ECR repositories for all 5 services with lifecycle policies.

### 3. Configure GitHub OIDC

Set up GitHub Actions to deploy to AWS without long-lived credentials.

**Create OIDC Provider:**
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list <GITHUB_THUMBPRINT>
```

**Create Deployment Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:sub": "repo:ORG/REPO:ref:refs/heads/main"
      }
    }
  }]
}
```

**Attach Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ecr:*",
      "ecs:*",
      "logs:*",
      "ssm:GetParameter*",
      "secretsmanager:GetSecretValue"
    ],
    "Resource": "*"
  }]
}
```

### 4. Set GitHub Secrets

In your GitHub repository settings:

- `AWS_ACCOUNT_ID` - Your AWS account ID
- `AWS_REGION` - `ap-southeast-5`

### 5. Set SSM Parameters

All environment variables are stored in AWS SSM Parameter Store or Secrets Manager:

```bash
# Common (all portals)
aws ssm put-parameter --name /cashsouk/prod/api-url \
  --value "https://api.cashsouk.com" --type String

aws ssm put-parameter --name /cashsouk/prod/cognito/domain \
  --value "https://cashsouk-prod.auth.ap-southeast-5.amazoncognito.com" --type String

aws ssm put-parameter --name /cashsouk/prod/cognito/client-id \
  --value "YOUR_CLIENT_ID" --type String

aws ssm put-parameter --name /cashsouk/prod/cognito/region \
  --value "ap-southeast-5" --type String

aws ssm put-parameter --name /cashsouk/prod/cloudfront/url \
  --value "https://assets.cashsouk.com" --type String

# API specific
aws secretsmanager create-secret \
  --name /cashsouk/prod/database-url \
  --secret-string "postgresql://user:pass@rds-endpoint:5432/cashsouk_prod"

aws ssm put-parameter --name /cashsouk/prod/s3/bucket-name \
  --value "cashsouk-prod-uploads" --type String

aws ssm put-parameter --name /cashsouk/prod/cors/allowed-origins \
  --value "https://cashsouk.com,https://investor.cashsouk.com,https://issuer.cashsouk.com,https://admin.cashsouk.com" \
  --type String
```

**See [Environment Variables](../guides/environment-variables.md) for complete list.**

### 6. Initial Database Migration

Run migrations manually before first deployment:

```bash
# From local machine or bastion host
cd apps/api
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### 7. Deploy

Push to `main` branch to trigger automated deployment:

```bash
git push origin main
```

GitHub Actions will:
1. ✅ Run tests (lint, typecheck, build)
2. 🐳 Build Docker images
3. 📦 Push images to ECR
4. 🗄️ Run database migrations
5. 🚀 Deploy to ECS (all 5 services)

## Deployment Workflow

The GitHub Actions workflow (`.github/workflows/deploy.yml`) handles everything automatically:

```yaml
on:
  push:
    branches: [main]

jobs:
  test → build → migrate → deploy
```

### What Gets Deployed

| Service | Image | ECS Service | ALB Host |
|---------|-------|-------------|----------|
| Landing | `cashsouk-landing` | `cashsouk-landing` | cashsouk.com |
| Investor | `cashsouk-investor` | `cashsouk-investor` | investor.cashsouk.com |
| Issuer | `cashsouk-issuer` | `cashsouk-issuer` | issuer.cashsouk.com |
| Admin | `cashsouk-admin` | `cashsouk-admin` | admin.cashsouk.com |
| API | `cashsouk-api` | `cashsouk-api` | api.cashsouk.com |

### Task Definitions

All task definitions are in `infra/ecs/`:

- `task-def-landing.json`
- `task-def-investor.json`
- `task-def-issuer.json`
- `task-def-admin.json`
- `task-def-api.json`
- `task-def-migrations.json`

These define:
- CPU/Memory allocation
- Environment variables
- Secrets (from SSM)
- Health checks
- Logging configuration

**CTOS full report HTML:** The API container image (`docker/api.Dockerfile`) must include `xsltproc` (via Alpine `libxslt`). Without it, CTOS snapshots still store XML and JSON, but `report_html` stays empty and admin “View full report” stays disabled.

## Monitoring & Operations

### CloudWatch Logs

```bash
# View logs
aws logs tail /ecs/cashsouk-landing --follow
aws logs tail /ecs/cashsouk-api --follow
```

### ECS Service Status

```bash
# List services
aws ecs list-services --cluster cashsouk-prod

# Check service health
aws ecs describe-services \
  --cluster cashsouk-prod \
  --services cashsouk-landing cashsouk-api
```

### ALB Target Health

```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:...
```

### Health Checks

- **Portals**: HTTP GET on `/`
- **API**: HTTP GET on `/healthz`

All return 200 if healthy.

## Rollback

### Automatic Rollback

ECS has circuit breaker enabled - automatically rolls back if deployment fails.

### Manual Rollback

```bash
# Rollback to previous task definition
aws ecs update-service \
  --cluster cashsouk-prod \
  --service cashsouk-landing \
  --task-definition cashsouk-landing:PREVIOUS_REVISION
```

## Environment Strategy

| Environment | Database | Apps | Config |
|-------------|----------|------|--------|
| **Local Dev** | Docker | pnpm | `.env.local` |
| **Prod** | RDS | ECS | SSM/Secrets |

**Local Development:**
- Database in Docker (easy reset)
- Apps run with pnpm (hot reload)
- `.env.local` files for config

**AWS Production:**
- Everything in Docker (reproducible)
- RDS PostgreSQL (managed)
- SSM Parameter Store (secure)

## Troubleshooting

### Deployment Failed

1. Check GitHub Actions logs
2. Verify all SSM parameters exist
3. Check ECS service events
4. Review CloudWatch logs

### Service Unhealthy

```bash
# Check task status
aws ecs describe-tasks \
  --cluster cashsouk-prod \
  --tasks TASK_ID

# View recent logs
aws logs tail /ecs/cashsouk-landing --since 10m
```

### Database Connection Issues

1. Verify RDS security group allows ECS
2. Check RDS endpoint is correct in SSM
3. Verify database credentials
4. Test from within VPC (bastion host)

### ECR Push Failures

```bash
# Login to ECR
aws ecr get-login-password --region ap-southeast-5 | \
  docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.ap-southeast-5.amazonaws.com
```

## Security Checklist

- [ ] HTTPS only (ACM certificates)
- [ ] WAF rules enabled
- [ ] Security groups properly configured
- [ ] RDS not publicly accessible
- [ ] Secrets in Secrets Manager (not SSM)
- [ ] IAM roles follow least privilege
- [ ] CloudWatch alarms configured
- [ ] Backup and disaster recovery tested

## Cost Optimization

**ECS Fargate:**
- Use minimum required CPU/memory
- Enable auto-scaling (scale down overnight)

**RDS:**
- Right-size instance
- Enable automated backups (7 days)
- Consider Reserved Instances for production

**S3:**
- Enable lifecycle policies
- Use Intelligent-Tiering

**CloudFront:**
- Cache static assets aggressively
- Use S3 origin for static content

## Performance Tips

1. **CloudFront**: Cache static assets with long TTL
2. **ALB**: Enable HTTP/2 and gzip
3. **RDS Proxy**: Use connection pooling
4. **ECS**: Set appropriate CPU/memory (monitor usage)
5. **Images**: Optimize Docker images (multi-stage builds)

## Additional Resources

- 📁 [infra/README.md](../../infra/README.md) - Complete infrastructure setup
- 📄 [AWS Infrastructure](../architecture/aws-infrastructure.md) - Detailed architecture
- 📄 [Environment Variables](../guides/environment-variables.md) - All configuration
- 📄 [Getting Started](../guides/getting-started.md) - Local development setup
- 📄 [Development Guide](../guides/development.md) - Development workflow

