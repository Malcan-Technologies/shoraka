#!/bin/sh
set -e

echo "🔍 Checking DATABASE_URL..."

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set"
  exit 1
fi

echo "✅ DATABASE_URL is set"

# Extract connection details from DATABASE_URL
# Format: postgresql://user:pass@host:port/dbname?schema=public
# We need to parse this carefully to handle passwords with special chars

# Extract host (everything between @ and :port or /dbname)
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|^postgresql://[^@]+@([^:/]+).*|\1|')

# Extract port (number between : and /)
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|^postgresql://[^:]+:[^@]+@[^:]+:([0-9]+)/.*|\1|')

# If port extraction failed, default to 5432
if [ -z "$DB_PORT" ] || ! echo "$DB_PORT" | grep -qE '^[0-9]+$'; then
  DB_PORT=5432
fi

echo "🔍 Checking database connection to ${DB_HOST}:${DB_PORT}..."

# Wait for database to be ready (max 60 seconds)
RETRY_COUNT=0
MAX_RETRIES=30

until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Database connection timeout after ${MAX_RETRIES} attempts"
    echo "Host: ${DB_HOST}"
    echo "Port: ${DB_PORT}"
    echo "DATABASE_URL format (masked): postgresql://***@${DB_HOST}:${DB_PORT}/***"
    exit 1
  fi
  echo "⏳ Waiting for database to be ready... (attempt ${RETRY_COUNT}/${MAX_RETRIES})"
  sleep 2
done

echo "✅ Database is ready"

# Construct PSQL_URL for psql commands (strip all query parameters)
# psql doesn't understand ?schema=public or other query params
# We need to remove everything after and including the ?
PSQL_URL=$(echo "$DATABASE_URL" | awk -F'?' '{print $1}')

echo "🔒 Acquiring migration lock..."

# Use PostgreSQL advisory lock to prevent concurrent migrations
# This ensures only ONE migration runs at a time across all containers
LOCK_ACQUIRED=$(psql "$PSQL_URL" -tAc "SELECT pg_try_advisory_lock(123456789);" 2>&1)

if echo "$LOCK_ACQUIRED" | grep -q "^t$"; then
  echo "✅ Lock acquired, running migrations..."

  cd /app/apps/api

  # Check for and resolve any failed migrations before running new ones
  echo "🔍 Checking for failed migrations..."
  FAILED_MIGRATIONS=$(psql "$PSQL_URL" -tAc "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND started_at IS NOT NULL;" 2>/dev/null || echo "")

  if [ -n "$FAILED_MIGRATIONS" ]; then
    echo "⚠️ Found failed migrations, attempting to resolve..."
    for MIGRATION in $FAILED_MIGRATIONS; do
      MIGRATION_NAME=$(echo "$MIGRATION" | xargs)
      echo "  - Resolving failed migration: $MIGRATION_NAME"

      # Self-heal for baseline migration that may already exist in prod
      if [ "$MIGRATION_NAME" = "20260226000000_baseline_corporate_individual_kyc_and_session" ]; then
        echo "    Checking baseline objects for: $MIGRATION_NAME"

        BASELINE_READY=$(psql "$PSQL_URL" -tAc "
          SELECT CASE
            WHEN to_regclass('public.corporate_individual_kyc') IS NOT NULL
            AND to_regclass('public.session') IS NOT NULL
            AND to_regclass('public.corporate_individual_kyc_cod_request_id_idx') IS NOT NULL
            AND to_regclass('public.corporate_individual_kyc_eod_request_id_key') IS NOT NULL
            AND to_regclass('public.corporate_individual_kyc_regtank_onboarding_id_idx') IS NOT NULL
            AND to_regclass('public.\"IDX_session_expire\"') IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = 'corporate_individual_kyc_regtank_onboarding_id_fkey'
            )
            THEN 't' ELSE 'f'
          END;
        " 2>/dev/null || echo "f")

        if [ "$(echo "$BASELINE_READY" | xargs)" = "t" ]; then
          echo "    ✅ Baseline objects already exist. Marking migration as applied..."
          pnpm prisma migrate resolve --applied "$MIGRATION_NAME" > /dev/null 2>&1 || true
          continue
        else
          echo "    ❌ Baseline objects are incomplete."
          echo "    Refusing to mark rolled back or re-run this migration automatically."
          echo "    Exiting safely to avoid destructive/partial actions."
          exit 1
        fi
      fi

      # For the specific organization invitations migration, check if tables exist
      if [ "$MIGRATION_NAME" = "20260115174209_add_organization_invitations" ]; then
        echo "    Checking if invitation tables exist..."
        TABLES_EXIST=$(psql "$PSQL_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('investor_organization_invitations', 'issuer_organization_invitations');" 2>/dev/null || echo "0")

        if [ "$TABLES_EXIST" = "2" ]; then
          echo "    ⚠️ Tables already exist - they may have been partially created"
          echo "    Dropping tables to allow clean re-run..."
          psql "$PSQL_URL" -c "DROP TABLE IF EXISTS issuer_organization_invitations CASCADE;" > /dev/null 2>&1
          psql "$PSQL_URL" -c "DROP TABLE IF EXISTS investor_organization_invitations CASCADE;" > /dev/null 2>&1
        fi

        # Check if enum values were added
        ENUM_VALUES=$(psql "$PSQL_URL" -tAc "SELECT COUNT(*) FROM pg_enum WHERE enumlabel IN ('ORGANIZATION_ADMIN', 'ORGANIZATION_MEMBER') AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrganizationMemberRole');" 2>/dev/null || echo "0")
        if [ "$ENUM_VALUES" != "2" ]; then
          echo "    Enum values not fully added, will be added in migration"
        fi
      fi

      # Mark migration as rolled back in database
      psql "$PSQL_URL" -c "UPDATE _prisma_migrations SET finished_at = NULL, applied_steps_count = 0 WHERE migration_name = '$MIGRATION_NAME' AND finished_at IS NULL;" > /dev/null 2>&1

      # Also try using Prisma's resolve command
      pnpm prisma migrate resolve --rolled-back "$MIGRATION_NAME" > /dev/null 2>&1 || true
    done
    echo "✅ Failed migrations resolved"
  else
    echo "✅ No failed migrations found"
  fi

  # Run migrations (Prisma uses the full DATABASE_URL with schema param)
  pnpm prisma migrate deploy

  MIGRATION_STATUS=$?

  # Release the lock
  psql "$PSQL_URL" -tAc "SELECT pg_advisory_unlock(123456789);" > /dev/null 2>&1

  if [ $MIGRATION_STATUS -eq 0 ]; then
    echo "✅ Migrations completed successfully"
    exit 0
  else
    echo "❌ Migrations failed"
    exit 1
  fi
else
  echo "⏳ Another migration is in progress, waiting..."

  # Wait for the other migration to complete
  WAIT_COUNT=0
  MAX_WAIT=30

  while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    LOCK_CHECK=$(psql "$PSQL_URL" -tAc "SELECT pg_try_advisory_lock(123456789);" 2>&1)
    if echo "$LOCK_CHECK" | grep -q "^t$"; then
      # Release immediately (we just checked if migrations are done)
      psql "$PSQL_URL" -tAc "SELECT pg_advisory_unlock(123456789);" > /dev/null 2>&1
      echo "✅ Migrations completed by another instance"
      exit 0
    fi

    WAIT_COUNT=$((WAIT_COUNT + 1))
    echo "⏳ Still waiting for migration lock... (${WAIT_COUNT}/${MAX_WAIT})"
    sleep 2
  done

  echo "❌ Timeout waiting for migrations to complete"
  exit 1
fi

