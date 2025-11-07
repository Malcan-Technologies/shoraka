# Shoraka P2P Lending Platform

A modern peer-to-peer lending platform built with Next.js, Express, PostgreSQL, and Prisma ORM.

## Architecture

This is a monorepo containing:

- **Frontend Apps** (Next.js 14+):
  - `apps/landing` - Marketing landing page (port 3000)
  - `apps/borrower` - Borrower portal (port 3001)
  - `apps/investor` - Investor portal (port 3002)
  - `apps/admin` - Admin dashboard (port 3003)
  
- **Backend API** (Express + Node.js):
  - `apps/api` - REST API with Prisma ORM (port 4000)

- **Shared Packages**:
  - `packages/ui` - Shared UI components (shadcn/ui)
  - `packages/styles` - Brand tokens and Tailwind config
  - `packages/types` - Shared TypeScript types
  - `packages/config` - API SDK and shared configuration
  - `packages/icons` - Shared icon library
  - `packages/testing` - Shared testing utilities

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui
- **Backend**: Node.js 20+, Express, Prisma ORM
- **Database**: PostgreSQL
- **Build**: Turborepo, pnpm
- **Deployment**: AWS (ECS Fargate, RDS, S3, CloudFront)

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/investor/.env.example apps/investor/.env
cp apps/borrower/.env.example apps/borrower/.env
cp apps/admin/.env.example apps/admin/.env
```

3. Run database migrations:
```bash
cd apps/api
pnpm prisma migrate dev
```

4. Start development servers:
```bash
pnpm dev
```

## Available Scripts

- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all apps for production
- `pnpm lint` - Lint all packages
- `pnpm typecheck` - Type-check all packages
- `pnpm test` - Run unit tests
- `pnpm e2e` - Run end-to-end tests

## Project Structure

```
.
├── apps/
│   ├── landing/        # Marketing landing page (port 3000)
│   ├── borrower/       # Borrower portal (port 3001)
│   ├── investor/       # Investor portal (port 3002)
│   ├── admin/          # Admin dashboard (port 3003)
│   └── api/            # Backend API (port 4000)
├── packages/
│   ├── ui/             # Shared UI components
│   ├── styles/         # Brand tokens & Tailwind config
│   ├── types/          # Shared TypeScript types
│   ├── config/         # API SDK & config
│   ├── icons/          # Icon library
│   └── testing/        # Testing utilities
├── docker/             # Dockerfiles for deployment
└── .cursor/            # Project rules and guidelines
```

## Development

Refer to the project rules in `.cursor/rules/` for detailed guidelines on:
- Backend architecture and patterns
- Frontend development standards
- Deployment procedures
- General coding standards

## Deployment

Deployment is handled via GitHub Actions to AWS ECS Fargate. See `.cursor/rules/deployment.mdc` for details.

## License

Proprietary

