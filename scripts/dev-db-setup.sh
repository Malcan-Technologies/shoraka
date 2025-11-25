#!/bin/bash
set -e

# Local Development Database Setup Script
echo "🚀 Setting up local development database..."

# Start PostgreSQL via Docker Compose
echo "📦 Starting PostgreSQL container..."
docker-compose up -d db

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo "✅ PostgreSQL is ready!"

# Run Prisma migrations
echo "📦 Running Prisma migrations..."
cd "$(dirname "$0")/../apps/api"

# Ensure .env file exists for local dev
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cat > .env << 'ENV'
DATABASE_URL="postgresql://postgres:password@localhost:5432/cashsouk_dev?schema=public"
NODE_ENV=development
PORT=4000
ENV
fi

# Run migrations
pnpm prisma migrate deploy

echo "✅ Migrations completed!"

# Optional: Seed the database
if [ -f "prisma/seed.ts" ] || [ -f "prisma/seed.js" ]; then
  echo "🌱 Seeding database..."
  pnpm prisma db seed
  echo "✅ Database seeded!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Local development database is ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Connection details:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: cashsouk_dev"
echo "  User: postgres"
echo "  Password: password"
echo ""
echo "🔗 Connection string:"
echo "  DATABASE_URL=\"postgresql://postgres:password@localhost:5432/cashsouk_dev?schema=public\""
echo ""
echo "📝 Next steps:"
echo "  1. Start the API: cd apps/api && pnpm dev"
echo "  2. View database: pnpm --filter api prisma studio"
echo "  3. Create migration: pnpm --filter api prisma migrate dev --name your_migration_name"
echo ""

