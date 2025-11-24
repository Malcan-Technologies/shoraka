# CashSouk P2P Lending Platform

Modern peer-to-peer lending platform built with Next.js, Express, and AWS.

![Architecture](https://img.shields.io/badge/AWS-ECS_Fargate-orange)
![Stack](https://img.shields.io/badge/Stack-Next.js_|_Express-blue)
![Database](https://img.shields.io/badge/Database-PostgreSQL-blue)
![Auth](https://img.shields.io/badge/Auth-AWS_Cognito-orange)

## Overview

CashSouk connects borrowers (issuers) with investors through a secure, transparent platform for peer-to-peer lending in Malaysia (MYR).

**Platform Components:**
- 🏠 **Landing Page** - Public-facing website
- 💰 **Investor Portal** - Browse and invest in loan opportunities
- 🏢 **Issuer Portal** - Apply for loans and manage applications
- 👨‍💼 **Admin Dashboard** - Platform management and operations
- 🔌 **REST API** - Backend services and business logic

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **State**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod
- **Icons**: Heroicons

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express 4
- **Database**: PostgreSQL 15 + Prisma ORM
- **Auth**: AWS Cognito + JWT
- **Logging**: Pino
- **Validation**: Zod

### Infrastructure
- **Cloud**: AWS (ap-southeast-5 Malaysia)
- **Compute**: ECS Fargate
- **Database**: RDS PostgreSQL
- **CDN**: CloudFront
- **Storage**: S3
- **Auth**: Cognito
- **CI/CD**: GitHub Actions

### Development
- **Package Manager**: pnpm 9
- **Build System**: Turborepo
- **Testing**: Playwright (E2E)
- **Containerization**: Docker

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd Shoraka

# Install dependencies
pnpm install

# Setup environment files
make setup-env

# Start PostgreSQL
docker run -d \
  --name cashsouk-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=cashsouk_dev \
  -p 5432:5432 \
  postgres:15-alpine

# Run migrations
cd apps/api
DATABASE_URL="postgresql://postgres:password@localhost:5432/cashsouk_dev" \
  npx prisma migrate dev --name init

# Start development servers (5 terminals)
pnpm --filter @cashsouk/api dev        # Port 4000
pnpm --filter @cashsouk/landing dev    # Port 3000
pnpm --filter @cashsouk/investor dev   # Port 3002
pnpm --filter @cashsouk/issuer dev     # Port 3001
pnpm --filter @cashsouk/admin dev      # Port 3003
```

**Access:**
- Landing: http://localhost:3000
- Investor: http://localhost:3002
- Issuer: http://localhost:3001
- Admin: http://localhost:3003
- API: http://localhost:4000

## Project Structure

```
Shoraka/
├── apps/                      # Applications
│   ├── api/                   # Express API (port 4000)
│   ├── landing/               # Landing page (port 3000)
│   ├── investor/              # Investor portal (port 3002)
│   ├── issuer/                # Issuer portal (port 3001)
│   └── admin/                 # Admin dashboard (port 3003)
├── packages/                  # Shared code
│   ├── ui/                    # shadcn components
│   ├── styles/                # Tailwind + CSS
│   ├── types/                 # TypeScript types
│   ├── config/                # Utilities & API client
│   ├── icons/                 # Icon library
│   └── testing/               # Test utilities
├── docs/                      # Documentation
│   ├── guides/                # How-to guides
│   ├── deployment/            # Deployment docs
│   └── architecture/          # Architecture docs
├── infra/                     # Infrastructure as Code
│   └── ecs/                   # ECS task definitions
├── scripts/                   # Helper scripts
├── docker/                    # Dockerfiles
└── env-templates/             # Environment templates
```

## Documentation

### Getting Started
- 📖 [Getting Started Guide](./docs/guides/getting-started.md) - Setup and installation
- 💻 [Development Guide](./docs/guides/development.md) - Local development workflow
- 🔐 [Authentication Guide](./docs/guides/authentication.md) - Auth implementation
- ⚙️ [Environment Variables](./docs/guides/environment-variables.md) - Configuration

### Architecture
- 🏗️ [Project Structure](./docs/architecture/project-structure.md) - Codebase organization
- ☁️ [AWS Infrastructure](./docs/architecture/aws-infrastructure.md) - Cloud architecture

### Deployment
- 🚀 [Deployment Guide](./docs/deployment/deployment.md) - AWS deployment
- 📁 [Infrastructure Setup](./infra/README.md) - AWS resource creation

### Design
- 🎨 [Brand Guidelines](./BRANDING.md) - Design system and UI standards

## Development

### Local Development
Uses **pnpm** (not Docker) for applications to enable hot reload and faster iteration:

```bash
# Database only runs in Docker
docker run -d --name cashsouk-postgres ...

# Apps run with pnpm
pnpm --filter @cashsouk/api dev      # Backend
pnpm --filter @cashsouk/landing dev  # Frontends
```

**Benefits:**
- ⚡ ~5 second startup (vs ~2 min with Docker)
- 🔥 Hot reload on save
- 🐛 Easy debugging with source maps
- 💾 Lower memory usage (~500MB vs ~2GB)

See [Development Guide](./docs/guides/development.md) for details.

### Production
All services run in **Docker containers** on AWS ECS Fargate:

```bash
# Build production images
docker-compose -f docker-compose.prod.yml up --build

# Or deploy to AWS (automated via GitHub Actions)
git push origin main
```

See [Deployment Guide](./docs/deployment/deployment.md) for details.

## Scripts

Common development commands:

```bash
make setup-env      # Copy environment templates
make db-up          # Start PostgreSQL
make db-migrate     # Run database migrations
make build-images   # Build all Docker images
make clean          # Clean up containers

pnpm install        # Install dependencies
pnpm build          # Build all packages
pnpm typecheck      # Type checking
pnpm lint           # Lint code
pnpm test           # Run tests
```

## Deployment

### Automated CI/CD

Pushing to `main` triggers automated deployment to AWS:

1. ✅ Run tests (lint, typecheck, build)
2. 🐳 Build Docker images
3. 📦 Push to ECR
4. 🗄️ Run migrations
5. 🚀 Deploy to ECS Fargate

**Services deployed:**
- Landing (cashsouk.com)
- Investor (investor.cashsouk.com)
- Issuer (issuer.cashsouk.com)
- Admin (admin.cashsouk.com)
- API (api.cashsouk.com)

See [Deployment Guide](./docs/deployment/deployment.md) and [Infrastructure Setup](./infra/README.md).

## Key Features

### Security
- ✅ AWS Cognito authentication
- ✅ JWT-based API authorization
- ✅ Role-based access control (RBAC)
- ✅ HTTPS everywhere (ACM certificates)
- ✅ WAF protection
- ✅ Encrypted database (RDS)
- ✅ Secrets management (AWS Secrets Manager)

### Scalability
- ✅ ECS Fargate auto-scaling
- ✅ RDS Proxy connection pooling
- ✅ CloudFront CDN
- ✅ Horizontal scaling ready

### Developer Experience
- ✅ TypeScript everywhere
- ✅ Hot reload in development
- ✅ Shared component library
- ✅ Automated testing
- ✅ CI/CD pipeline
- ✅ Comprehensive documentation

## Environment Variables

Local development uses `.env.local` files (templates in `env-templates/`):

```bash
# API
DATABASE_URL=postgresql://postgres:password@localhost:5432/cashsouk_dev
JWT_SECRET=dev-secret-change-in-prod

# Frontends
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Production uses AWS SSM Parameter Store and Secrets Manager.

See [Environment Variables Guide](./docs/guides/environment-variables.md) for complete reference.

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally
3. Run quality checks: `pnpm typecheck && pnpm lint`
4. Commit: `git commit -m "feat: add your feature"`
5. Push and create PR: `git push origin feature/your-feature`

### Commit Convention
```
feat: new feature
fix: bug fix
docs: documentation
style: formatting
refactor: code refactoring
test: tests
chore: maintenance
```

## License

Private - All rights reserved

## Support

For questions or issues, please contact the development team.

---

**Built with ❤️ by the CashSouk Team**
