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

