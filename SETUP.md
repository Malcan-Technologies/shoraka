# Setup Guide - Shoraka P2P Lending Platform

This guide will help you set up the Shoraka P2P lending platform for local development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20.x or later
- **pnpm** 9.x or later
- **PostgreSQL** 15.x or later
- **Git**

## Installation Steps

### 1. Install Dependencies

```bash
pnpm install
```

This will install all dependencies for all apps and packages in the monorepo.

### 2. Set Up PostgreSQL Database

Create a PostgreSQL database for development:

```bash
createdb shoraka_dev
```

Or using psql:

```sql
CREATE DATABASE shoraka_dev;
```

### 3. Configure Environment Variables

Copy the environment example files and update them with your configuration:

```bash
# API
cp apps/api/.env.example apps/api/.env

# Landing Page
cp apps/landing/.env.example apps/landing/.env

# Borrower Portal
cp apps/borrower/.env.example apps/borrower/.env

# Investor Portal
cp apps/investor/.env.example apps/investor/.env

# Admin Portal
cp apps/admin/.env.example apps/admin/.env
```

Update `apps/api/.env` with your database credentials:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/shoraka_dev?schema=public"
JWT_SECRET=your-super-secret-jwt-key-change-this
```

### 4. Generate Prisma Client and Run Migrations

```bash
cd apps/api
pnpm prisma generate
pnpm prisma migrate dev --name init
```

This will:
- Generate the Prisma Client
- Create the database tables based on the schema
- Run the initial migration

### 5. (Optional) Seed the Database

Create a seed file if you need test data:

```bash
cd apps/api
pnpm prisma db seed
```

### 6. Start Development Servers

From the root directory, start all services:

```bash
pnpm dev
```

This will start:
- **Landing Page**: http://localhost:3000
- **Borrower Portal**: http://localhost:3001
- **Investor Portal**: http://localhost:3002
- **Admin Portal**: http://localhost:3003
- **API**: http://localhost:4000

### 7. Verify Installation

Check that all services are running:

- Landing Page: http://localhost:3000
- Borrower Portal: http://localhost:3001
- Investor Portal: http://localhost:3002
- Admin Portal: http://localhost:3003
- API Health: http://localhost:4000/healthz

## Development Workflow

### Running Individual Apps

```bash
# API only
pnpm --filter @shoraka/api dev

# Landing page only
pnpm --filter @shoraka/landing dev

# Borrower portal only
pnpm --filter @shoraka/borrower dev

# Investor portal only
pnpm --filter @shoraka/investor dev

# Admin portal only
pnpm --filter @shoraka/admin dev
```

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

### Running Tests

```bash
# Unit tests
pnpm test

# E2E tests
pnpm e2e
```

### Database Management

```bash
# Open Prisma Studio (database GUI)
cd apps/api
pnpm prisma studio

# Create a new migration
pnpm prisma migrate dev --name your_migration_name

# Reset database (WARNING: deletes all data)
pnpm prisma migrate reset
```

### Building for Production

```bash
pnpm build
```

This will build all apps and packages.

## Project Structure

```
shoraka/
├── apps/
│   ├── landing/         # Landing page (Next.js) - port 3000
│   ├── borrower/        # Borrower portal (Next.js) - port 3001
│   ├── investor/        # Investor portal (Next.js) - port 3002
│   ├── admin/           # Admin dashboard (Next.js) - port 3003
│   └── api/             # Backend API (Express) - port 4000
├── packages/
│   ├── ui/              # Shared UI components
│   ├── styles/          # Tailwind config & tokens
│   ├── types/           # TypeScript types
│   ├── config/          # API client & config
│   ├── icons/           # Icon library
│   └── testing/         # Testing utilities
├── docker/              # Docker files for deployment
├── scripts/             # Deployment scripts
└── .cursor/             # Project rules
```

## Troubleshooting

### Port Already in Use

If you get "port already in use" errors, you can:

1. Kill the process using the port:
```bash
lsof -ti:3000 | xargs kill -9  # For landing page
lsof -ti:3001 | xargs kill -9  # For borrower portal
lsof -ti:3002 | xargs kill -9  # For investor portal
lsof -ti:3003 | xargs kill -9  # For admin portal
lsof -ti:4000 | xargs kill -9  # For API
```

2. Or change the ports in each app's `package.json` dev script

### Database Connection Issues

- Ensure PostgreSQL is running: `pg_ctl status`
- Check your DATABASE_URL in `apps/api/.env`
- Verify database exists: `psql -l`

### Prisma Client Not Generated

```bash
cd apps/api
pnpm prisma generate
```

### Node Modules Issues

If you encounter module resolution issues:

```bash
pnpm clean
rm -rf node_modules
pnpm install
```

## Next Steps

1. Review the [BRANDING.md](./BRANDING.md) for design guidelines
2. Check `.cursor/rules/` for development standards
3. Read [README.md](./README.md) for project overview
4. Start building features following the architecture patterns

## Getting Help

- Check existing documentation in `.cursor/rules/`
- Review code examples in packages and apps
- Refer to the tech stack documentation:
  - [Next.js](https://nextjs.org/docs)
  - [Express](https://expressjs.com/)
  - [Prisma](https://www.prisma.io/docs)
  - [Tailwind CSS](https://tailwindcss.com/docs)
  - [shadcn/ui](https://ui.shadcn.com/)

