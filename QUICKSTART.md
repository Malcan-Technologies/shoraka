# Quick Start Guide

Get the Shoraka P2P Lending Platform up and running in 5 minutes.

## Prerequisites

Ensure you have installed:
- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

## Setup (5 Steps)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Setup Database

```bash
# Create database
createdb shoraka_dev

# Configure environment
cd apps/api
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Run Migrations

```bash
cd apps/api
pnpm prisma generate
pnpm prisma migrate dev --name init
```

### 4. Setup Frontend Environment

```bash
# Landing page
cp apps/landing/.env.example apps/landing/.env

# Borrower portal
cp apps/borrower/.env.example apps/borrower/.env

# Investor portal
cp apps/investor/.env.example apps/investor/.env

# Admin portal
cp apps/admin/.env.example apps/admin/.env
```

### 5. Start All Services

```bash
# From root directory
pnpm dev
```

## Access the Applications

Once running, access:

- **Landing Page**: http://localhost:3000
- **Borrower Portal**: http://localhost:3001
- **Investor Portal**: http://localhost:3002
- **Admin Portal**: http://localhost:3003
- **API**: http://localhost:4000
- **API Health**: http://localhost:4000/healthz

## Verify Installation

Check that all services respond:

```bash
# Test API
curl http://localhost:4000/healthz

# Test portals (should return HTML)
curl http://localhost:3000
curl http://localhost:3001
curl http://localhost:3002
curl http://localhost:3003
```

## Common Commands

```bash
# Start all services
pnpm dev

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Run tests
pnpm test

# Run E2E tests
pnpm e2e

# Build for production
pnpm build

# Open database GUI
cd apps/api && pnpm prisma studio
```

## Project Structure

```
shoraka/
├── apps/
│   ├── landing/        # Landing page (port 3000)
│   ├── borrower/       # Borrower portal (port 3001)
│   ├── investor/       # Investor portal (port 3002)
│   ├── admin/          # Admin dashboard (port 3003)
│   └── api/            # Backend API (port 4000)
├── packages/
│   ├── ui/             # Shared components
│   ├── styles/         # Design tokens
│   ├── types/          # TypeScript types
│   ├── config/         # API client
│   ├── icons/          # Icons
│   └── testing/        # Test utilities
└── docker/             # Deployment files
```

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, shadcn/ui
- **Backend**: Node.js 20, Express, Prisma ORM
- **Database**: PostgreSQL
- **Tools**: pnpm, Turborepo, Playwright

## Next Steps

1. **Explore the code**: Start with `apps/investor/src/app/page.tsx`
2. **Read the rules**: Check `.cursor/rules/` for development guidelines
3. **Review branding**: See `BRANDING.md` for design tokens
4. **Build features**: Follow the patterns in existing code

## Need Help?

- **Setup Issues**: See [SETUP.md](./SETUP.md) for detailed instructions
- **Project Structure**: See [STRUCTURE.md](./STRUCTURE.md) for complete layout
- **Development Guidelines**: See `.cursor/rules/` for best practices

## Troubleshooting

### Port Already in Use
```bash
# Kill processes on ports
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
lsof -ti:3002 | xargs kill -9
lsof -ti:3003 | xargs kill -9
lsof -ti:4000 | xargs kill -9
```

### Database Connection Error
- Check PostgreSQL is running: `pg_ctl status`
- Verify DATABASE_URL in `apps/api/.env`

### Module Not Found
```bash
pnpm clean
rm -rf node_modules
pnpm install
```

---

**You're all set! Happy coding! 🚀**

