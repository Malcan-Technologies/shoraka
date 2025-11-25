# Database Setup Summary

## ✅ What's Already Done

### 1. Local Development Database

- ✅ PostgreSQL container running via Docker Compose
- ✅ Database: `cashsouk_dev`
- ✅ All Prisma migrations applied
- ✅ `.env` file created in `apps/api/`
- ✅ Ready to start developing!

**Connection:**

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/cashsouk_dev?schema=public"
```

### 2. Production Migration Strategy

- ✅ Migration Docker image (`docker/migrate.Dockerfile`)
- ✅ Advisory lock mechanism to prevent race conditions
- ✅ GitHub Actions workflow updated to run migrations before API deployment
- ✅ ECS task definition template created

---

## 🔄 Development Workflow

### Daily Development

```bash
# Start local database (if not running)
docker-compose up -d db

# Start API
cd apps/api && pnpm dev

# View database in browser
pnpm --filter api prisma studio
```

### Making Schema Changes

```bash
# 1. Edit schema
#    apps/api/prisma/schema.prisma

# 2. Create migration
cd apps/api
pnpm prisma migrate dev --name add_new_field

# 3. Test locally
pnpm dev

# 4. Commit and push
git add apps/api/prisma/
git commit -m "feat(db): add new field"
git push origin main

# 5. GitHub Actions will:
#    - Build images
#    - Run migrations (race-condition-safe)
#    - Deploy API
```

---

## 📋 Remaining Setup Steps

### For Production Database

Since RDS connection is timing out (private IP), you have a few options:

#### **Option 1: Temporarily Enable Public Access (Quick)**

1. AWS Console → RDS → cashsouk-prod-db → Modify
2. Set "Public access" → Yes
3. Apply immediately
4. Wait 5-10 minutes
5. Run: `./scripts/setup-rds-database.sh`
6. Revert public access to No

#### **Option 2: Use AWS CloudShell (Recommended)**

1. Open AWS Console → Click CloudShell icon
2. Install PostgreSQL client:
   ```bash
   sudo dnf install -y postgresql15
   ```
3. Upload and run the setup script:
   ```bash
   # Copy/paste the script content or upload via CloudShell
   chmod +x setup-rds-database.sh
   ./setup-rds-database.sh
   ```

#### **Option 3: Create Bastion Host**

1. Launch EC2 instance in public subnet (same VPC as RDS)
2. SSH to bastion
3. Run setup script from there

### For Migration Infrastructure

Once RDS is accessible, run:

```bash
# 1. Setup AWS infrastructure for migrations
./scripts/setup-migration-infrastructure.sh

# This creates:
#  - ECR repository: cashsouk-migrate
#  - CloudWatch log group
#  - ECS task definition
#  - IAM permissions
```

---

## 🎯 What You Get After Full Setup

### Local Development

- ✅ Instant database setup with one command
- ✅ Hot reload during development
- ✅ Prisma Studio for visual data management
- ✅ Full migration history tracking

### Production Deployment

- ✅ Automatic migrations on every API deployment
- ✅ **Zero race conditions** (PostgreSQL advisory locks)
- ✅ Automatic rollback if migration fails
- ✅ CloudWatch logs for debugging
- ✅ Secure credential management via AWS Secrets Manager

### Workflow Benefits

- ✅ **Push to main → Automatic deployment**
- ✅ No manual migration commands needed
- ✅ Database schema always in sync
- ✅ Safe for team collaboration (no conflicts)
- ✅ Audit trail of all schema changes

---

## 📖 Documentation

- **Complete Workflow:** `docs/guides/database-workflow.md`
- **RDS Setup Guide:** `RDS_SETUP_GUIDE.md`

---

## 🐛 Troubleshooting

### Local Database

**Issue:** Can't connect to local database

```bash
# Check if container is running
docker-compose ps

# Restart database
docker-compose restart db

# View logs
docker-compose logs db
```

**Issue:** Migrations out of sync

```bash
# Reset database
pnpm --filter api prisma migrate reset

# Or just apply pending migrations
pnpm --filter api prisma migrate deploy
```

### Production

**Issue:** Migration fails during deployment

- Check GitHub Actions logs for error details
- Check CloudWatch logs: `/ecs/cashsouk-migrate`
- Fix schema, create new migration, push again

**Issue:** RDS connection timeout

- Verify security group allows ECS security group on port 5432
- Check RDS is in correct VPC/subnet
- Verify ECS task has network connectivity to RDS

---

## 🚀 Quick Start Commands

```bash
# Local Development
./scripts/dev-db-setup.sh              # First time setup
cd apps/api && pnpm dev                 # Start API
pnpm --filter api prisma studio         # Visual database browser

# Create New Migration
cd apps/api
pnpm prisma migrate dev --name my_change

# Deploy to Production
git push origin main                    # Automatic!

# Production Database Setup (when RDS is accessible)
./scripts/setup-rds-database.sh         # One-time setup
./scripts/setup-migration-infrastructure.sh  # One-time AWS infrastructure
```

---

## ✅ Checklist

### Local Development

- [x] PostgreSQL running
- [x] Migrations applied
- [x] `.env` configured
- [x] Ready to develop!

### Production (Pending)

- [ ] Run `./scripts/setup-rds-database.sh` (once RDS is accessible)
- [ ] Run `./scripts/setup-migration-infrastructure.sh`
- [ ] Push a test migration to verify workflow

---

## 🎉 You're All Set!

Your local development environment is ready. Once you resolve the RDS connectivity issue and run the setup scripts, your production deployment will be fully automated.

**Happy coding!** 🚀
