# Database Development & Deployment Workflow

This guide covers the complete database workflow from local development to production deployment.

---

## **Local Development Setup**

### **1. Start Local Database**

```bash
# One-command setup
./scripts/dev-db-setup.sh
```

This will:
- ✅ Start PostgreSQL container via Docker Compose
- ✅ Wait for database to be ready
- ✅ Run all existing Prisma migrations
- ✅ Create `.env` file in `apps/api/`

### **2. Manual Setup (Alternative)**

```bash
# Start PostgreSQL
docker-compose up -d db

# Create .env file
cd apps/api
cat > .env << 'EOF'
DATABASE_URL="postgresql://postgres:password@localhost:5432/cashsouk_dev?schema=public"
NODE_ENV=development
PORT=4000
EOF

# Run migrations
pnpm prisma migrate deploy

# Start API
pnpm dev
```

### **3. Database Management Commands**

```bash
# View database in Prisma Studio
pnpm --filter api prisma studio

# Reset database (⚠️ destroys all data)
pnpm --filter api prisma migrate reset

# Generate Prisma Client after schema changes
pnpm --filter api prisma generate

# Check migration status
pnpm --filter api prisma migrate status
```

---

## **Creating Database Changes**

### **1. Update Prisma Schema**

Edit `apps/api/prisma/schema.prisma`:

```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  // Add new field
  phoneNumber String?
  created_at  DateTime @default(now())
}
```

### **2. Create Migration**

```bash
cd apps/api

# Create migration with descriptive name
pnpm prisma migrate dev --name add_phone_number_to_users
```

This will:
- Generate SQL migration file in `prisma/migrations/`
- Apply migration to local database
- Regenerate Prisma Client

### **3. Review Migration File**

Check the generated SQL in `prisma/migrations/XXXXXX_add_phone_number_to_users/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "users" ADD COLUMN "phoneNumber" TEXT;
```

### **4. Test Locally**

```bash
# Start API and test the changes
pnpm dev

# Run tests if available
pnpm test
```

---

## **Deploying to Production**

### **Workflow Overview**

```
Local Dev → Git Push → GitHub Actions → Build Images → Run Migrations → Deploy API
```

### **Step-by-Step**

#### **1. Commit Your Changes**

```bash
git add apps/api/prisma/schema.prisma
git add apps/api/prisma/migrations/
git commit -m "feat(db): add phone number field to users"
git push origin main
```

#### **2. GitHub Actions Automatically:**

1. ✅ Detects API code changes
2. ✅ Builds API Docker image
3. ✅ **Runs migrations via ECS task** (with advisory lock to prevent race conditions)
4. ✅ Deploys new API version to ECS

The migration happens **BEFORE** deploying the new API, ensuring:
- No downtime
- No race conditions (advisory lock ensures only one migration runs at a time)
- Automatic rollback if migration fails (API won't deploy)

#### **3. Migration Process Details**

When API code changes are detected, GitHub Actions:

```yaml
1. Build migration Docker image
2. Run ECS task with migration image
   - Task acquires PostgreSQL advisory lock (prevents concurrent migrations)
   - Runs: prisma migrate deploy
   - Releases lock
   - Exits with success/failure
3. If migration succeeds → Deploy API
4. If migration fails → Stop deployment, show logs
```

**Advisory Lock Magic:**
```sql
-- Only ONE migration can run at a time
SELECT pg_try_advisory_lock(123456789);  -- Returns true for first caller, false for others

-- Other containers wait for lock to be released
-- This prevents race conditions when deploying multiple API containers
```

---

## **Production Database Management**

### **Connecting to Production Database**

#### **Via RDS Proxy (Application Connection)**

```bash
# Get credentials from AWS Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id prod/cashsouk/db \
  --region ap-southeast-5 \
  --query SecretString \
  --output text | jq -r .

# Connect via psql
psql "postgresql://cashsouk_app:PASSWORD@cashsouk-prod-proxy.proxy-c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com:5432/cashsouk"
```

#### **Via Direct RDS (Admin/Migrations)**

```bash
# Use master credentials
psql "postgresql://cashsouk_admin:PASSWORD@cashsouk-prod-db.c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com:5432/cashsouk"
```

### **Manual Migration (Emergency)**

If you need to run migrations manually (not recommended for normal deployments):

```bash
# Get master credentials
export DATABASE_URL="postgresql://cashsouk_admin:PASSWORD@cashsouk-prod-db.c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com:5432/cashsouk"

# Run migrations
cd apps/api
pnpm prisma migrate deploy
```

### **Viewing Migration Status**

```bash
# Check which migrations have been applied
pnpm --filter api prisma migrate status --schema=./prisma/schema.prisma
```

---

## **Best Practices**

### **✅ DO**

1. **Always test migrations locally first**
   ```bash
   pnpm prisma migrate dev --name my_migration
   # Test thoroughly
   git push  # Deploy to prod
   ```

2. **Use descriptive migration names**
   ```bash
   # Good
   pnpm prisma migrate dev --name add_user_roles
   pnpm prisma migrate dev --name create_access_logs_table
   
   # Bad
   pnpm prisma migrate dev --name update
   pnpm prisma migrate dev --name fix
   ```

3. **Make migrations backwards-compatible when possible**
   ```prisma
   # Adding optional field - safe
   model User {
     phoneNumber String?  // ✅ Optional
   }
   
   # Adding required field - needs default or data migration
   model User {
     phoneNumber String @default("")  // ✅ Has default
   }
   ```

4. **Review generated SQL before deploying**
   - Check `prisma/migrations/*/migration.sql`
   - Ensure no data loss
   - Check for performance impact (indexes, etc.)

5. **Keep schema.prisma in sync with database**
   ```bash
   # If manual changes were made, pull them
   pnpm prisma db pull
   ```

### **❌ DON'T**

1. **Don't edit migration files after they're created**
   - Create a new migration instead

2. **Don't delete migration files**
   - Prisma uses them to track applied migrations

3. **Don't run migrations manually in production**
   - Let GitHub Actions handle it (unless emergency)

4. **Don't make breaking schema changes without a migration strategy**
   ```prisma
   # Breaking: Removing required field
   model User {
     - email String  // ❌ Data loss!
   }
   
   # Better: Mark as optional first, deploy, then remove later
   model User {
     email String?  // ✅ Step 1: Make optional
   }
   # Deploy, migrate data, then remove in next migration
   ```

---

## **Troubleshooting**

### **Migration fails in production**

**Check logs:**
```bash
# GitHub Actions will show migration task logs
# Or check CloudWatch logs for task: cashsouk-migrate
```

**Common issues:**
- Missing permissions (ensure app user has DDL rights)
- Breaking change (data doesn't match new schema)
- Network issue (ECS can't reach RDS)

**Solution:**
1. Fix the issue (update schema, add data migration)
2. Create new migration
3. Push again

### **Race condition during deployment**

**Won't happen!** Advisory lock prevents it:
- Multiple API containers deploying simultaneously
- Only ONE migration task runs
- Others wait for the lock to be released

### **Local database out of sync**

```bash
# Reset and reapply all migrations
pnpm --filter api prisma migrate reset

# Or just run pending migrations
pnpm --filter api prisma migrate deploy
```

### **Need to rollback a migration**

**Prisma doesn't support automatic rollbacks.** You must:

1. Create a new migration that reverses the changes
   ```bash
   # Manually edit schema to reverse
   pnpm prisma migrate dev --name revert_phone_number
   ```

2. Or restore from RDS snapshot (destructive)

---

## **Advanced: Data Migrations**

For complex schema changes that require data transformation:

### **Option 1: SQL Data Migration**

```typescript
// prisma/migrations/XXXXX_add_full_name/migration.sql

-- Add new column
ALTER TABLE "users" ADD COLUMN "full_name" TEXT;

-- Populate from existing data
UPDATE "users" SET "full_name" = CONCAT("first_name", ' ', "last_name");

-- Make it required (now that it has data)
ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL;
```

### **Option 2: Application-Level Data Migration**

```typescript
// apps/api/prisma/data-migrations/001-populate-full-names.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { fullName: `${user.firstName} ${user.lastName}` }
    });
  }
}

migrate().catch(console.error);
```

Run before deploying:
```bash
tsx apps/api/prisma/data-migrations/001-populate-full-names.ts
```

---

## **Monitoring**

### **CloudWatch Logs**

Migration logs are in `/ecs/cashsouk-migrate` log group.

### **Prisma Migration Table**

Prisma tracks applied migrations in the `_prisma_migrations` table:

```sql
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;
```

---

## **Summary: Complete Workflow**

```bash
# 1. Local Development
./scripts/dev-db-setup.sh                    # Setup
cd apps/api && pnpm dev                       # Start API
pnpm prisma studio                            # View data

# 2. Make Schema Changes
# Edit apps/api/prisma/schema.prisma

# 3. Create Migration
pnpm prisma migrate dev --name my_change      # Creates migration

# 4. Test Locally
pnpm dev                                      # Test
pnpm test                                     # Run tests

# 5. Deploy to Production
git add apps/api/prisma/
git commit -m "feat(db): my change"
git push origin main                          # GitHub Actions handles the rest!

# GitHub Actions will:
# - Build images
# - Run migrations (with race condition protection)
# - Deploy API
```

**That's it!** No manual intervention needed for production deployments. 🚀

