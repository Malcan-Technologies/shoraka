# Migration-only Docker image
# Used for running Prisma migrations in production without race conditions
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Create .npmrc to enable hoisting
RUN echo "shamefully-hoist=true" > .npmrc
RUN echo "public-hoist-pattern[]=*" >> .npmrc

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile

COPY apps/api/prisma ./apps/api/prisma
COPY packages ./packages

# Generate Prisma Client
RUN cd apps/api && pnpm prisma generate

# Runner stage
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install PostgreSQL client for health checks
RUN apk add --no-cache postgresql-client

# Copy workspace files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema and migrations
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages ./packages

# Create migration script with advisory lock to prevent race conditions
RUN cat > /app/migrate.sh << 'EOF'
#!/bin/sh
set -e

echo "🔍 Checking database connection..."

# Wait for database to be ready
until pg_isready -h "${DB_HOST}" -p "${DB_PORT:-5432}" -U "${DB_USER}" 2>/dev/null; do
  echo "⏳ Waiting for database to be ready..."
  sleep 2
done

echo "✅ Database is ready"

# Construct DATABASE_URL if not provided
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}?schema=public"
fi

echo "🔒 Acquiring migration lock..."

# Use PostgreSQL advisory lock to prevent concurrent migrations
# This ensures only ONE migration runs at a time across all containers
LOCK_ACQUIRED=$(psql "$DATABASE_URL" -tAc "SELECT pg_try_advisory_lock(123456789);")

if [ "$LOCK_ACQUIRED" = "t" ]; then
  echo "✅ Lock acquired, running migrations..."
  
  cd /app/apps/api
  
  # Run migrations
  pnpm prisma migrate deploy
  
  MIGRATION_STATUS=$?
  
  # Release the lock
  psql "$DATABASE_URL" -tAc "SELECT pg_advisory_unlock(123456789);" > /dev/null
  
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
  while ! psql "$DATABASE_URL" -tAc "SELECT pg_try_advisory_lock(123456789);" | grep -q "t"; do
    echo "⏳ Still waiting for migration lock..."
    sleep 2
  done
  
  # Release immediately (we just checked if migrations are done)
  psql "$DATABASE_URL" -tAc "SELECT pg_advisory_unlock(123456789);" > /dev/null
  
  echo "✅ Migrations completed by another instance"
  exit 0
fi
EOF

RUN chmod +x /app/migrate.sh

CMD ["/app/migrate.sh"]

