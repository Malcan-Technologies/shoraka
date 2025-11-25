#!/bin/sh
set -e

echo "🔍 Checking database connection..."

# Wait for database to be ready
until pg_isready -h "${DB_HOST}" -p "${DB_PORT:-5432}" -U "${DB_USER}" 2>/dev/null; do
  echo "⏳ Waiting for database to be ready..."
  sleep 2
done

echo "✅ Database is ready"

# Construct DATABASE_URL for Prisma (with schema parameter)
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}?schema=public"
fi

# Construct PSQL_URL for psql commands (without schema parameter)
PSQL_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}"

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

