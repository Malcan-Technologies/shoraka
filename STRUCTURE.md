# Project Structure

Complete directory structure of the Shoraka P2P Lending Platform monorepo.

```
shoraka/
├── .cursor/
│   └── rules/
│       ├── backend.mdc          # Backend development rules
│       ├── frontend.mdc         # Frontend development rules
│       ├── deployment.mdc       # Deployment guidelines
│       └── general.mdc          # General coding standards
│
├── .github/
│   └── workflows/
│       ├── ci.yml               # Continuous integration workflow
│       └── deploy.yml           # Production deployment workflow
│
├── .vscode/
│   ├── extensions.json          # Recommended VS Code extensions
│   └── settings.json            # VS Code workspace settings
│
├── apps/
│   ├── landing/                 # Landing Page (Next.js)
│   │   ├── .cursorrules         # Frontend rules for landing app
│   │   ├── src/
│   │   │   └── app/
│   │   │       ├── layout.tsx   # Root layout with theme
│   │   │       ├── page.tsx     # Coming soon page
│   │   │       └── globals.css  # Global styles
│   │   ├── e2e/
│   │   │   └── home.spec.ts     # Playwright E2E tests
│   │   ├── next.config.js       # Next.js configuration
│   │   ├── tailwind.config.ts   # Tailwind configuration
│   │   ├── postcss.config.js    # PostCSS configuration
│   │   ├── tsconfig.json        # TypeScript configuration
│   │   ├── package.json         # Dependencies
│   │   └── .env.example         # Environment variables template
│   │
│   ├── borrower/                # Borrower Portal (Next.js)
│   │   ├── .cursorrules         # Frontend rules for borrower app
│   │   ├── src/
│   │   │   └── app/
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx
│   │   │       └── globals.css
│   │   ├── e2e/
│   │   │   └── home.spec.ts
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── investor/                # Investor Portal (Next.js)
│   │   ├── .cursorrules         # Frontend rules for investor app
│   │   ├── src/
│   │   │   └── app/
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx
│   │   │       └── globals.css
│   │   ├── e2e/
│   │   │   └── home.spec.ts
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── admin/                   # Admin Dashboard (Next.js)
│   │   ├── .cursorrules         # Frontend rules for admin app
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx   # Root layout with dashboard
│   │   │   │   ├── page.tsx     # Dashboard page
│   │   │   │   └── globals.css  # Global styles
│   │   │   └── components/      # Dashboard components
│   │   │       ├── sidebar.tsx  # Collapsible sidebar
│   │   │       ├── header.tsx   # Top header
│   │   │       └── ...          # Other components
│   │   ├── e2e/
│   │   │   └── home.spec.ts
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── .env.example
│   │
│   └── api/                     # Backend API (Express)
│       ├── .cursorrules         # Backend rules for API
│       ├── prisma/
│       │   └── schema.prisma    # Database schema
│       ├── src/
│       │   ├── app/
│       │   │   ├── index.ts     # Express app factory
│       │   │   └── middleware/
│       │   │       └── cors.ts  # Correlation ID middleware
│       │   ├── lib/
│       │   │   ├── auth/
│       │   │   │   ├── jwt.ts   # JWT utilities
│       │   │   │   └── middleware.ts  # Auth middleware
│       │   │   ├── http/
│       │   │   │   ├── error-handler.ts  # Error handling
│       │   │   │   └── not-found.ts      # 404 handler
│       │   │   ├── logger.ts    # Pino logger configuration
│       │   │   └── prisma.ts    # Prisma client singleton
│       │   ├── routes.ts        # Route registration
│       │   └── index.ts         # Entry point
│       ├── jest.config.js       # Jest configuration
│       ├── tsconfig.json        # TypeScript configuration
│       ├── package.json         # Dependencies
│       └── .env.example         # Environment variables template
│
├── packages/
│   ├── ui/                      # Shared UI Components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── button.tsx   # Button component
│   │   │   │   └── card.tsx     # Card component
│   │   │   ├── lib/
│   │   │   │   └── utils.ts     # Utility functions (cn)
│   │   │   └── index.ts         # Package exports
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── styles/                  # Brand Tokens & Tailwind Config
│   │   ├── globals.css          # Global CSS with design tokens
│   │   ├── tailwind.config.ts   # Shared Tailwind configuration
│   │   └── package.json
│   │
│   ├── types/                   # Shared TypeScript Types
│   │   ├── src/
│   │   │   └── index.ts         # Type definitions (User, Loan, etc.)
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── config/                  # API Client & Configuration
│   │   ├── src/
│   │   │   ├── api-client.ts    # Type-safe API client
│   │   │   └── index.ts         # Package exports
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── icons/                   # Icon Library (lucide-react)
│   │   ├── src/
│   │   │   └── index.ts         # Icon exports
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── testing/                 # Testing Utilities
│       ├── src/
│       │   ├── playwright/
│       │   │   └── index.ts     # Playwright helpers
│       │   └── index.ts         # Package exports
│       ├── tsconfig.json
│       └── package.json
│
├── docker/                      # Deployment Dockerfiles
│   ├── api.Dockerfile           # API container
│   ├── landing.Dockerfile       # Landing page container
│   ├── portal-borrower.Dockerfile
│   ├── portal-investor.Dockerfile
│   └── portal-admin.Dockerfile
│
├── scripts/
│   └── ecs-update.sh            # ECS service update script
│
├── .eslintrc.js                 # ESLint configuration
├── .gitignore                   # Git ignore patterns
├── .prettierrc                  # Prettier configuration
├── BRANDING.md                  # Brand guidelines & design tokens
├── package.json                 # Root package with workspace scripts
├── playwright.config.ts         # Playwright E2E configuration
├── pnpm-workspace.yaml          # pnpm workspace configuration
├── README.md                    # Project overview
├── SETUP.md                     # Setup instructions
├── STRUCTURE.md                 # This file
├── tsconfig.json                # Root TypeScript configuration
└── turbo.json                   # Turborepo build configuration
```

## Key Files

### Configuration Files

- **pnpm-workspace.yaml**: Defines the monorepo workspace structure
- **turbo.json**: Configures Turborepo for efficient builds
- **tsconfig.json**: Base TypeScript configuration inherited by all packages
- **playwright.config.ts**: E2E test configuration

### Documentation

- **README.md**: Project overview and quick start
- **SETUP.md**: Detailed setup instructions
- **BRANDING.md**: Design system and brand guidelines
- **STRUCTURE.md**: Complete project structure (this file)

### Rules & Guidelines

- **.cursor/rules/**: Development guidelines and architectural patterns
  - Applied automatically to respective folders via `.cursorrules` symlinks

### Deployment

- **docker/**: Production-ready Dockerfiles for each service
- **.github/workflows/**: CI/CD pipelines for testing and deployment
- **scripts/**: Deployment automation scripts

## Port Allocation

- **Landing Page**: 3000
- **Borrower Portal**: 3001
- **Investor Portal**: 3002
- **Admin Portal**: 3003
- **API**: 4000

## Tech Stack Summary

### Frontend (All Portals)
- Next.js 14 (App Router)
- React 18
- TypeScript 5
- Tailwind CSS 3
- shadcn/ui components
- TanStack Query for data fetching
- React Hook Form + Zod for forms

### Backend (API)
- Node.js 20
- Express 4
- TypeScript 5
- Prisma ORM 5
- PostgreSQL 15
- Pino for logging
- JWT authentication

### Build & Development
- pnpm 9 (package manager)
- Turborepo (build system)
- Playwright (E2E testing)
- Jest (unit testing)

### Deployment
- Docker containers
- AWS ECS Fargate
- AWS RDS PostgreSQL
- AWS S3 for uploads
- GitHub Actions for CI/CD

## Next Steps

1. Follow [SETUP.md](./SETUP.md) to get started
2. Review [BRANDING.md](./BRANDING.md) for design guidelines
3. Check `.cursor/rules/` for development standards
4. Start building features following the established patterns

