#!/bin/sh
set -e

echo "🔍 Checking DATABASE_URL..."

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set"
  exit 1
fi

echo "✅ DATABASE_URL is set"

# Extract host from DATABASE_URL for pg_isready check
# Example: postgresql://user:pass@host:5432/dbname?schema=public
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')

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
    exit 1
  fi
  echo "⏳ Waiting for database to be ready... (attempt ${RETRY_COUNT}/${MAX_RETRIES})"
  sleep 2
done

echo "✅ Database is ready"

# Construct PSQL_URL for psql commands (without schema parameter)
# Use parameter expansion to remove the query string
PSQL_URL="${DATABASE_URL%%\?*}"

echo "🔒 Acquiring migration lock..."

# Use PostgreSQL advisory lock to prevent concurrent migrations
# This ensures only ONE migration runs at a time across all containers
LOCK_ACQUIRED=$(psql "$PSQL_URL" -tAc "SELECT pg_try_advisory_lock(123456789);")

if [ "$LOCK_ACQUIRED" = "t" ]; then
  echo "✅ Lock acquired, running migrations..."
  
  cd /app/apps/api
  
  # Run migrations
  pnpm prisma migrate deploy
  
  MIGRATION_STATUS=$?
  
  # Release the lock
  psql "$PSQL_URL" -tAc "SELECT pg_advisory_unlock(123456789);" > /dev/null
  
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
  while ! psql "$PSQL_URL" -tAc "SELECT pg_try_advisory_lock(123456789);" | grep -q "t"; do
    echo "⏳ Still waiting for migration lock..."
    sleep 2
  done
  
  # Release immediately (we just checked if migrations are done)
  psql "$PSQL_URL" -tAc "SELECT pg_advisory_unlock(123456789);" > /dev/null
  
  echo "✅ Migrations completed by another instance"
  exit 0
fi

