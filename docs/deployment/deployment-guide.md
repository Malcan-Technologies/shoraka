# Deployment Guide

CashSouk uses **automated deployment via GitHub Actions** to AWS. Developers push code, and the platform handles the rest.

## For Developers: Quick Reference

### Automatic Deployment

**Push to `main` branch** → Triggers automatic deployment to production.

```bash
git add .
git commit -m "feat: add new feature"
git push origin main
```

GitHub Actions will:

1. ✅ Run tests and type checks
2. ✅ Build Docker images
3. ✅ Run database migrations
4. ✅ Deploy to AWS ECS
5. ✅ Health check new containers

**Deployment time:** ~5-8 minutes

### Manual Deployment

For selective deployments:

1. Go to **GitHub** → **Actions** tab
2. Select **"Deploy All Services (Manual)"**
3. Click **"Run workflow"**
4. Select services to deploy:
   - ☐ API
   - ☐ Landing
   - ☐ Investor
   - ☐ Issuer
   - ☐ Admin
5. Click **"Run workflow"**

### Checking Deployment Status

**GitHub Actions:**

- Go to **Actions** tab
- Click on the latest workflow run
- Expand steps to see detailed logs

**Production URLs:**

- Landing: https://cashsouk.com
- Investor: https://investor.cashsouk.com
- Issuer: https://issuer.cashsouk.com
- Admin: https://admin.cashsouk.com
- API: https://api.cashsouk.com

### Rolling Back

If deployment fails or introduces issues:

1. Go to **GitHub** → **Actions**
2. Find the **last successful deployment**
3. Click **"Re-run jobs"**

OR revert the commit:

```bash
git revert HEAD
git push origin main
```

## Environment Variables

Production environment variables are stored in **GitHub Secrets**.

**Current secrets (managed by DevOps):**

- `NEXT_PUBLIC_API_URL` - Production API URL
- `DATABASE_URL` - RDS connection string
- `AWS_REGION` - Deployment region
- Other AWS/service credentials

> ⚠️ **Developers**: Never commit secrets or API keys. Use `.env.local` for local development.

## Database Migrations

Migrations run **automatically** during deployment:

1. GitHub Actions builds a migration container
2. Runs `prisma migrate deploy`
3. Only proceeds if migration succeeds
4. Then deploys application containers

**To create a migration:**

```bash
cd apps/api
pnpm prisma migrate dev --name your_migration_name
git add prisma/migrations
git commit -m "chore: add database migration"
git push
```

The migration will run automatically on next deployment.

## Monitoring

**CloudWatch Logs:**
Access via AWS Console (DevOps team manages access)

**Health Checks:**

- API: https://api.cashsouk.com/healthz
- Admin dashboard shows system health

**Alerts:**
CloudWatch alarms notify team of:

- Deployment failures
- API errors (5XX)
- High resource usage

## Troubleshooting

### Deployment Failed

1. Check **GitHub Actions** logs
2. Look for error in failed step
3. Fix issue locally and push again

### App Not Responding After Deployment

1. Check **ECS service health** (DevOps)
2. Review **CloudWatch logs**
3. Verify environment variables are set

### Database Migration Failed

1. Check migration logs in GitHub Actions
2. Fix migration SQL
3. May need to manually rollback (contact DevOps)

## Architecture Overview (High Level)

```
GitHub Push
    ↓
GitHub Actions (CI/CD)
    ↓
Build Docker Images
    ↓
Push to AWS ECR (Container Registry)
    ↓
Run Database Migrations
    ↓
Deploy to AWS ECS Fargate
    ↓
Load Balancer Routes Traffic
    ↓
Production Live ✅
```

**AWS Services Used:**

- **ECS Fargate** - Runs containers (no servers to manage)
- **ALB** - Load balancer
- **RDS PostgreSQL** - Database
- **ECR** - Docker image registry
- **CloudWatch** - Logs and monitoring

## For DevOps: Detailed Setup

See separate guides:

- [AWS Infrastructure Setup](./manual-aws-console-setup.md)
- [GitHub Actions Setup](./github-actions-setup.md)
- [Optimization Guide](./deployment-optimization.md)

## Best Practices

1. **Test Locally First** - Always test changes locally before pushing
2. **Small Commits** - Easier to identify issues and rollback
3. **Monitor After Deploy** - Check health endpoints after deployment
4. **Database Backups** - RDS automated backups run daily (managed by DevOps)
5. **Review Logs** - Check CloudWatch if anything seems off

## Questions?

- **Code Issues**: Check [Local Development Setup](../guides/local-development-setup.md)
- **Deployment Issues**: Contact DevOps team
- **Architecture Questions**: See [AWS Infrastructure](../architecture/aws-infrastructure.md)
