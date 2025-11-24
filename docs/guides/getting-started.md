# Getting Started

Complete guide to setting up and running the CashSouk P2P Lending Platform locally.

## Prerequisites

Ensure you have installed:

- **Node.js** 20.x or later
- **pnpm** 9.x or later
- **PostgreSQL** 15.x or later (or Docker)
- **Git**

## Quick Start (5 Minutes)

### 1. Clone and Install

```bash
git clone <repository-url>
cd Shoraka
pnpm install
```

### 2. Start Database

**Option A: Docker (Recommended)**

```bash
docker run -d \
  --name cashsouk-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=cashsouk_dev \
  -p 5432:5432 \
  postgres:15-alpine
```

**Option B: Local PostgreSQL**

```bash
createdb cashsouk_dev
```

### 3. Setup Environment

```bash
make setup-env
```

This copies all environment templates from `env-templates/` to each app's `.env.local` file.

### 4. Run Database Migrations

```bash
cd apps/api
DATABASE_URL="postgresql://postgres:password@localhost:5432/cashsouk_dev" \
  npx prisma migrate dev --name init
cd ../..
```

### 5. Start Development Servers

Open 5 separate terminal windows:

```bash
# Terminal 1 - API (Port 4000)
pnpm --filter @cashsouk/api dev

# Terminal 2 - Landing Page (Port 3000)
pnpm --filter @cashsouk/landing dev

# Terminal 3 - Investor Portal (Port 3002)
pnpm --filter @cashsouk/investor dev

# Terminal 4 - Issuer Portal (Port 3001)
pnpm --filter @cashsouk/issuer dev

# Terminal 5 - Admin Portal (Port 3003)
pnpm --filter @cashsouk/admin dev
```

### 6. Access Applications

- **Landing Page**: http://localhost:3000
- **Issuer Portal**: http://localhost:3001
- **Investor Portal**: http://localhost:3002
- **Admin Portal**: http://localhost:3003
- **API**: http://localhost:4000
- **API Health**: http://localhost:4000/healthz

## Detailed Setup

### Environment Variables

Each application requires environment variables. Templates are in `env-templates/`:

- `api.env.local` - Backend API configuration
- `landing.env.local` - Landing page
- `investor.env.local` - Investor portal
- `issuer.env.local` - Issuer portal
- `admin.env.local` - Admin portal

**Manual Setup:**

```bash
cp env-templates/api.env.local apps/api/.env.local
cp env-templates/landing.env.local apps/landing/.env.local
cp env-templates/investor.env.local apps/investor/.env.local
cp env-templates/issuer.env.local apps/issuer/.env.local
cp env-templates/admin.env.local apps/admin/.env.local
```

Edit each `.env.local` file as needed for your local setup.

### Database Management

**View tables:**

```bash
docker exec cashsouk-postgres psql -U postgres -d cashsouk_dev -c "\dt"
```

**Access PostgreSQL:**

```bash
docker exec -it cashsouk-postgres psql -U postgres -d cashsouk_dev
```

**Reset database:**

```bash
docker exec cashsouk-postgres psql -U postgres -c "DROP DATABASE cashsouk_dev;"
docker exec cashsouk-postgres psql -U postgres -c "CREATE DATABASE cashsouk_dev;"
cd apps/api && npx prisma migrate dev --name init
```

**Stop database:**

```bash
docker stop cashsouk-postgres
docker rm cashsouk-postgres
```

### Using Make Commands

The project includes a `Makefile` with helpful shortcuts:

```bash
make setup-env      # Copy environment templates
make db-up          # Start PostgreSQL in Docker
make db-migrate     # Run Prisma migrations
make db-stop        # Stop PostgreSQL
make db-rm          # Remove PostgreSQL container
make build-images   # Build all Docker images
make clean          # Clean up containers
```

## Building for Production

### Local Production Build

Build all applications:

```bash
pnpm build
```

Or build individually:

```bash
pnpm --filter @cashsouk/api build
pnpm --filter @cashsouk/landing build
pnpm --filter @cashsouk/investor build
pnpm --filter @cashsouk/issuer build
pnpm --filter @cashsouk/admin build
```

### Docker Production Build

Build all services with Docker Compose:

```bash
docker-compose -f docker-compose.prod.yml up --build
```

This uses `.env.prod` files and runs all services in containers.

## Verification

### Check All Services

```bash
# API Health
curl http://localhost:4000/healthz

# Database
docker exec cashsouk-postgres psql -U postgres -d cashsouk_dev -c "SELECT COUNT(*) FROM users;"

# Build all apps
pnpm build
```

### Run Tests

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Unit tests (when available)
pnpm test

# E2E tests (when available)
pnpm e2e
```

## Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

```bash
# Find process using port
lsof -ti:3000  # or 3001, 3002, 3003, 4000

# Kill process
kill -9 $(lsof -ti:3000)
```

### Database Connection Issues

1. Verify PostgreSQL is running:

   ```bash
   docker ps | grep cashsouk-postgres
   ```

2. Check connection string in `.env.local`:

   ```
   DATABASE_URL=postgresql://postgres:password@localhost:5432/cashsouk_dev
   ```

3. Test connection:
   ```bash
   docker exec cashsouk-postgres psql -U postgres -l
   ```

### pnpm Install Errors

If dependencies fail to install:

```bash
# Clear cache
pnpm store prune

# Remove node_modules
rm -rf node_modules apps/*/node_modules packages/*/node_modules

# Reinstall
pnpm install
```

### Prisma Issues

Regenerate Prisma client:

```bash
cd apps/api
npx prisma generate
npx prisma migrate reset
```

## Next Steps

- Read [Development Guide](./development.md) for workflow and best practices
- Review [Project Structure](../architecture/project-structure.md) to understand the codebase
- Check [Authentication Guide](./authentication.md) for auth implementation
- See [Environment Variables](./environment-variables.md) for configuration details

## Additional Resources

- [Deployment Guide](../deployment/deployment.md) - AWS deployment instructions
- [AWS Infrastructure](../architecture/aws-infrastructure.md) - Infrastructure overview
- [Brand Guidelines](../../BRANDING.md) - Design system and UI standards
