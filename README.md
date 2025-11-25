# CashSouk P2P Lending Platform

A modern peer-to-peer lending platform built with Next.js, Express, and PostgreSQL.

## 🚀 Quick Start

### For Developers

```bash
# 1. Install dependencies
pnpm install

# 2. Start database
docker-compose up -d

# 3. Run migrations
cd apps/api && pnpm prisma migrate dev && cd ../..

# 4. Copy environment files
cp env-templates/api.env.local apps/api/.env.local
cp env-templates/admin.env.local apps/admin/.env.local
# ... (repeat for other apps)

# 5. Start development
pnpm dev
```

**📖 Full Setup Guide:** [Local Development Setup](./docs/guides/local-development-setup.md)

### For DevOps

Deployment is automated via GitHub Actions. See:
- **[Deployment Guide](./docs/deployment/deployment-guide.md)** - Overview
- **[AWS Setup](./docs/deployment/manual-aws-console-setup.md)** - Infrastructure
- **[GitHub Actions](./docs/deployment/github-actions-setup.md)** - CI/CD

## 📚 Documentation

**Complete documentation:** [docs/README.md](./docs/README.md)

### Essential Guides
- 🚀 [Local Development Setup](./docs/guides/local-development-setup.md) - Start here
- 📦 [Deployment Guide](./docs/deployment/deployment-guide.md) - Push to deploy
- 🗄️ [Database Workflow](./docs/guides/database-workflow.md) - Prisma & migrations
- 🎨 [Brand Guidelines](./BRANDING.md) - Design system

### Architecture
- [Project Structure](./docs/architecture/project-structure.md) - Monorepo organization
- [AWS Infrastructure](./docs/architecture/aws-infrastructure.md) - Cloud setup

## 🏗️ Project Structure

```
Shoraka/
├── apps/
│   ├── admin/          # Admin dashboard
│   ├── api/            # Backend API (Express + Prisma)
│   ├── investor/       # Investor portal
│   ├── issuer/         # Issuer portal
│   └── landing/        # Landing page
├── packages/
│   ├── ui/             # Shared UI components (shadcn/ui)
│   ├── styles/         # Brand tokens & global styles
│   ├── types/          # Shared TypeScript types
│   ├── config/         # Utilities
│   └── icons/          # Icons
├── docker/             # Dockerfiles
├── infra/              # Infrastructure config
└── docs/               # Documentation
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - App Router, React Server Components
- **shadcn/ui** - UI components
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

### Backend
- **Express** - API server
- **Prisma** - Database ORM
- **PostgreSQL** - Database
- **Zod** - Validation

### Infrastructure
- **AWS ECS Fargate** - Container hosting
- **AWS RDS** - Managed PostgreSQL
- **AWS ALB** - Load balancing
- **GitHub Actions** - CI/CD

## 📝 Environment Variables

See `env-templates/` for all environment variable templates.

**Required for local development:**
- `DATABASE_URL` - PostgreSQL connection
- `NEXT_PUBLIC_API_URL` - API endpoint

**Full reference:** [Environment Variables Guide](./docs/guides/environment-variables.md)

## 🧪 Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm e2e

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Testing with Docker (Production-like)

```bash
# Build and test locally
docker build -f docker/api.Dockerfile -t cashsouk-api:local .
docker run -p 4000:4000 cashsouk-api:local
```

**Full guide:** [Local Development Setup - Docker Section](./docs/guides/local-development-setup.md#testing-with-docker-production-like-environment)

## 🚀 Deployment

Push to `main` branch triggers automatic deployment:

```bash
git push origin main
```

**Deployment time:** ~5-8 minutes

See [Deployment Guide](./docs/deployment/deployment-guide.md) for details.

## 📊 Monitoring

- **Health Checks:** https://api.cashsouk.com/healthz
- **CloudWatch Logs:** AWS Console (DevOps access)
- **Admin Dashboard:** System health monitoring

## 🤝 Contributing

1. Create a feature branch
2. Make changes
3. Test locally
4. Push and create PR
5. Automated checks run
6. Merge to deploy

## 📜 License

Proprietary - All rights reserved

## 🆘 Need Help?

- **Development:** [Local Setup Guide](./docs/guides/local-development-setup.md)
- **Deployment:** [Deployment Guide](./docs/deployment/deployment-guide.md)
- **Full Docs:** [docs/README.md](./docs/README.md)
