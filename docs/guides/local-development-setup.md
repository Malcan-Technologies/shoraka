# Local Development Setup

Complete guide for setting up CashSouk for local development.

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** 9.0.0+
- **Docker Desktop** (for local database)
- **Git**

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/Malcan-Technologies/shoraka/
cd Shoraka
pnpm install
```

### 2. Start Local Database

```bash
# Start PostgreSQL in Docker
docker-compose up -d

# Run migrations
cd apps/api
pnpm prisma migrate dev
cd ../..
```

### 3. Configure Environment Variables

Create `.env.local` files for each app:

**`apps/api/.env.local`:**

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/cashsouk_dev?schema=public"
NODE_ENV=development
PORT=4000
```

**`apps/admin/.env.local`:**

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**`apps/investor/.env.local`:**

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**`apps/issuer/.env.local`:**

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**`apps/landing/.env.local`:**

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

> **Note**: `.env.local` files are gitignored and never committed. See `env-templates/` for all available options.

### 4. Start Development Servers

```bash
# Terminal 1: API
cd apps/api
pnpm dev

# Terminal 2: Admin Portal
cd apps/admin
pnpm dev

# Terminal 3: Investor Portal
cd apps/investor
pnpm dev

# Terminal 4: Issuer Portal
cd apps/issuer
pnpm dev

# Terminal 5: Landing Page
cd apps/landing
pnpm dev
```

**Access URLs:**

- Landing: http://localhost:3000
- Investor Portal: http://localhost:3002
- Issuer Portal: http://localhost:3001
- Admin Portal: http://localhost:3003
- API: http://localhost:4000
- API Health: http://localhost:4000/healthz

## Development Workflow

### Database Changes

```bash
# Create a new migration
cd apps/api
pnpm prisma migrate dev --name your_migration_name

# Reset database (dev only)
pnpm prisma migrate reset

# Open Prisma Studio
pnpm prisma studio
```

### Adding UI Components

```bash
# Install from shadcn/ui
npx shadcn@latest add button

# Components go to packages/ui/src/
```

### Running Tests

```bash
# Unit tests
pnpm test

# E2E tests (requires apps running)
pnpm e2e

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Code Quality

Before committing:

```bash
# Run all checks
pnpm typecheck && pnpm lint && pnpm test
```

## Testing with Docker (Production-like Environment)

Running apps in Docker locally helps catch issues before production.

### Prerequisites

- Docker Desktop installed and running
- GitHub secret values (ask DevOps for production API URL)

### Building Docker Images Locally

**Build API:**

```bash
docker build -f docker/api.Dockerfile -t cashsouk-api:local .
```

**Build Admin Portal:**

```bash
docker build -f docker/portal-admin.Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 \
  -t cashsouk-admin:local .
```

**Build Other Portals:**

```bash
# Investor
docker build -f docker/portal-investor.Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 \
  -t cashsouk-investor:local .

# Issuer
docker build -f docker/portal-issuer.Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 \
  -t cashsouk-issuer:local .

# Landing
docker build -f docker/landing.Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 \
  -t cashsouk-landing:local .
```

### Running Docker Containers Locally

**Run API:**

```bash
docker run -p 4000:4000 \
  -e DATABASE_URL="postgresql://postgres:password@host.docker.internal:5432/cashsouk_dev?schema=public" \
  -e NODE_ENV=development \
  -e PORT=4000 \
  cashsouk-api:local
```

> **Note:** Use `host.docker.internal` to connect to localhost from inside Docker

**Run Admin Portal:**

```bash
docker run -p 3003:3000 cashsouk-admin:local
```

**Run Other Portals:**

```bash
# Investor (port 3002)
docker run -p 3002:3000 cashsouk-investor:local

# Issuer (port 3001)
docker run -p 3001:3000 cashsouk-issuer:local

# Landing (port 3000)
docker run -p 3000:3000 cashsouk-landing:local
```

### Using Docker Compose for Full Stack

Create a `docker-compose.local.yml`:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: cashsouk_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    image: cashsouk-api:local
    depends_on:
      - postgres
    environment:
      DATABASE_URL: "postgresql://postgres:password@postgres:5432/cashsouk_dev?schema=public"
      NODE_ENV: development
      PORT: 4000
    ports:
      - "4000:4000"

  admin:
    image: cashsouk-admin:local
    depends_on:
      - api
    ports:
      - "3003:3000"

  investor:
    image: cashsouk-investor:local
    depends_on:
      - api
    ports:
      - "3002:3000"

  issuer:
    image: cashsouk-issuer:local
    depends_on:
      - api
    ports:
      - "3001:3000"

  landing:
    image: cashsouk-landing:local
    depends_on:
      - api
    ports:
      - "3000:3000"

volumes:
  postgres_data:
```

**Run full stack:**

```bash
# Build all images first (see commands above)
# Then start all services
docker-compose -f docker-compose.local.yml up
```

### Benefits of Docker Testing

1. **Production Parity** - Same environment as production
2. **Catch Build Issues** - Find Dockerfile problems early
3. **Test Environment Variables** - Verify `.env.production` works
4. **Integration Testing** - Test all services together
5. **Clean Environment** - No local dependencies interfere

### When to Use Docker vs Native

**Use Native (`pnpm dev`):**

- ✅ Day-to-day development
- ✅ Fast hot-reload
- ✅ Easy debugging
- ✅ Quick iterations

**Use Docker:**

- ✅ Before pushing to production
- ✅ Testing Dockerfile changes
- ✅ Reproducing production issues
- ✅ Testing full stack integration
- ✅ Verifying environment variables

### Debugging Docker Containers

**View logs:**

```bash
docker logs <container-id>

# Follow logs
docker logs -f <container-id>
```

**Execute commands inside container:**

```bash
docker exec -it <container-id> sh

# Example: Check if env var is set
docker exec <container-id> env | grep NEXT_PUBLIC_API_URL
```

**Inspect container:**

```bash
docker inspect <container-id>
```

**Clean up:**

```bash
# Stop all containers
docker-compose -f docker-compose.local.yml down

# Remove images
docker rmi cashsouk-api:local cashsouk-admin:local

# Clean everything (use with caution)
docker system prune -a
```

## Project Structure

```
Shoraka/
├── apps/
│   ├── admin/          # Admin dashboard (Next.js)
│   ├── api/            # Backend API (Express + Prisma)
│   ├── investor/       # Investor portal (Next.js)
│   ├── issuer/         # Issuer portal (Next.js)
│   └── landing/        # Landing page (Next.js)
├── packages/
│   ├── ui/             # Shared UI components (shadcn)
│   ├── styles/         # Brand tokens & global styles
│   ├── types/          # Shared TypeScript types
│   ├── config/         # Shared utilities
│   └── icons/          # Icon components
└── docker/             # Dockerfiles for deployment
```

## Common Issues

### Port Already in Use

```bash
# Kill process on port 4000 (API)
lsof -ti:4000 | xargs kill -9

# Or use different port in .env.local
PORT=4001
```

### Database Connection Error

```bash
# Ensure Docker is running
docker ps

# Restart database
docker-compose restart
```

### Module Not Found

```bash
# Reinstall dependencies
pnpm install --frozen-lockfile

# Clear Next.js cache
rm -rf apps/*/.next
```

### Prisma Client Out of Sync

```bash
cd apps/api
pnpm prisma generate
```

## Environment Variables Reference

See `env-templates/README.md` for complete list of all environment variables.

**Required for Development:**

- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_API_URL` - API endpoint for frontends

**Optional (for full features):**

- `COGNITO_*` - AWS Cognito (when implementing auth)
- `S3_BUCKET` - File uploads (when implementing uploads)
- `ALLOWED_ORIGINS` - CORS configuration

## Deployment

Production deployment is handled via GitHub Actions. See [Deployment Guide](../deployment/deployment-guide.md).

Developers should focus on:

1. Writing code
2. Testing locally
3. Pushing to GitHub
4. GitHub Actions handles the rest ✨

## Next Steps

- [Development Workflow](./development.md) - Day-to-day development tasks
- [Database Workflow](./database-workflow.md) - Working with Prisma
- [Brand Guidelines](../../BRANDING.md) - Design system
- [Project Structure](../architecture/project-structure.md) - Understanding the codebase
