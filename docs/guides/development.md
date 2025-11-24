# Development Guide

Complete guide for local development workflow and best practices.

## Development vs Production

### Local Development (pnpm + Docker DB)

```
┌─────────────────────────────────────┐
│    Your Development Machine         │
├─────────────────────────────────────┤
│  🐳 Docker: PostgreSQL only         │
│  ⚡ pnpm: All apps (hot reload)     │
└─────────────────────────────────────┘
```

**Why not Docker for apps?**

| Feature | pnpm Dev | Docker |
|---------|----------|--------|
| Startup | ~5 sec | ~2 min |
| Hot Reload | ✅ Instant | ❌ No |
| TypeScript | ✅ Real-time | ⏳ Rebuild |
| Debugging | ✅ Easy | ⚠️ Complex |
| Memory | ~500MB | ~2GB |

### AWS Production (All Docker)

```
┌────────────────────────────────────┐
│         AWS ECS Fargate            │
├────────────────────────────────────┤
│  🐳 All 5 services in containers   │
│  🗄️  RDS PostgreSQL               │
│  🌐 ALB + CloudFront              │
└────────────────────────────────────┘
```

**Benefits:**
- Reproducible builds
- Easy scaling
- Health monitoring
- Consistent environment

## Development Workflow

### Daily Development

```bash
# 1. Start database (once)
make db-up

# 2. Start your service (in separate terminal)
pnpm --filter @cashsouk/api dev        # Backend
pnpm --filter @cashsouk/landing dev    # Landing page
pnpm --filter @cashsouk/investor dev   # Investor portal
pnpm --filter @cashsouk/issuer dev     # Issuer portal
pnpm --filter @cashsouk/admin dev      # Admin portal

# 3. Make changes → See updates in 1-2 seconds ⚡
```

### Project Structure

```
Shoraka/
├── apps/                    # Applications
│   ├── api/                # Express backend (port 4000)
│   ├── landing/            # Public landing (port 3000)
│   ├── investor/           # Investor portal (port 3002)
│   ├── issuer/             # Issuer portal (port 3001)
│   └── admin/              # Admin dashboard (port 3003)
├── packages/                # Shared code
│   ├── ui/                 # shadcn components
│   ├── styles/             # Tailwind + CSS
│   ├── types/              # TypeScript types
│   ├── config/             # Shared config
│   └── testing/            # Test utilities
└── docs/                    # Documentation
```

See [Project Structure](../architecture/project-structure.md) for details.

### Code Organization

**Backend (apps/api):**
```
apps/api/src/
├── app/              # Express setup
├── modules/          # Feature modules
│   ├── auth/        # Authentication
│   ├── loan/        # Loan management
│   └── ...
├── lib/              # Utilities
│   ├── auth/        # JWT, middleware
│   ├── logger/      # Pino logging
│   └── http/        # Error handling
└── routes.ts         # Route registration
```

**Frontend (all portals):**
```
apps/{portal}/src/
├── app/              # Next.js app router
│   ├── (auth)/      # Auth routes
│   ├── layout.tsx   # Root layout
│   └── page.tsx     # Home page
├── components/       # Portal-specific components
└── lib/              # Portal-specific utilities
```

**Shared UI (packages/ui):**
```
packages/ui/src/
├── components/       # shadcn components
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
└── lib/              # Utilities (cn, etc.)
```

## Development Best Practices

### Frontend Development

#### Component Structure

```tsx
// Use Server Components by default
export default function MyPage() {
  return <div>...</div>;
}

// Use 'use client' only when needed
'use client';
export function InteractiveButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

#### Import from Shared Packages

```tsx
// ✅ Good - Import from shared packages
import { Button, Card } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import type { Loan } from "@cashsouk/types";

// ❌ Bad - Don't copy/paste components
import { Button } from "./copied-button";
```

#### Follow Brand Guidelines

```tsx
// ✅ Good - Use Tailwind tokens
<button className="bg-primary text-primary-foreground">Submit</button>

// ❌ Bad - Hardcoded colors
<button className="bg-[#8B1538]">Submit</button>
```

See [BRANDING.md](../../BRANDING.md) for full guidelines.

#### Forms

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  amount: z.number().min(1000).max(1000000),
  term: z.number().min(1).max(60),
});

export function LoanForm() {
  const form = useForm({
    resolver: zodResolver(schema),
  });
  
  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>;
}
```

### Backend Development

#### Module Pattern

```typescript
// apps/api/src/modules/loan/
├── controller.ts    // HTTP layer
├── service.ts       // Business logic
├── repository.ts    // Database layer
└── schemas.ts       // Validation schemas

// Flow: Controller → Service → Repository
```

#### API Response Format

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "correlationId": "..."
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": { ... }
  },
  "correlationId": "..."
}
```

#### Logging

```typescript
import { logger } from '@/lib/logger';

logger.info({ userId, loanId }, 'Loan application submitted');
logger.error({ err, userId }, 'Failed to process loan');

// Never log PII directly
logger.info({ userId: maskUserId(userId) }, '...');
```

#### Database Queries

```typescript
// ✅ Good - Use transactions for multi-step operations
await prisma.$transaction(async (tx) => {
  await tx.loan.update({ ... });
  await tx.investment.create({ ... });
});

// ✅ Good - Select only needed columns
const loans = await prisma.loan.findMany({
  select: { id: true, amount: true, status: true }
});

// ❌ Bad - N+1 queries
for (const loan of loans) {
  const user = await prisma.user.findUnique({ where: { id: loan.userId } });
}

// ✅ Good - Use include
const loans = await prisma.loan.findMany({
  include: { user: true }
});
```

### Shared Code

**When to create shared code:**
- Used in 2+ apps
- Pure utility functions
- Type definitions
- UI components

**Where to put it:**
- `packages/ui` - UI components
- `packages/config` - Configuration & utilities
- `packages/types` - TypeScript types
- `packages/styles` - Tailwind config & CSS

## Testing

### Type Checking

```bash
# Check all packages
pnpm typecheck

# Check specific package
pnpm --filter @cashsouk/api typecheck
```

### Linting

```bash
# Lint all packages
pnpm lint

# Lint specific package
pnpm --filter @cashsouk/landing lint

# Auto-fix
pnpm lint --fix
```

### Unit Tests (when available)

```bash
pnpm test
pnpm test:watch
pnpm test:coverage
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
pnpm e2e

# Run specific portal
pnpm --filter @cashsouk/investor e2e

# UI mode for debugging
pnpm e2e --ui
```

## Database Management

### Migrations

```bash
# Create new migration
cd apps/api
npx prisma migrate dev --name add_user_kyc

# Apply migrations
npx prisma migrate dev

# Reset database (DEV ONLY!)
npx prisma migrate reset

# Production migrations
npx prisma migrate deploy
```

### Prisma Studio

```bash
cd apps/api
npx prisma studio
```

Opens at http://localhost:5555 - GUI for viewing/editing data.

### Seed Data

```bash
cd apps/api
npx prisma db seed
```

## Debugging

### VS Code Launch Configuration

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@cashsouk/api", "dev"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Chrome DevTools (Next.js)

1. Start dev server
2. Open Chrome DevTools
3. Click Node.js icon (green) → Opens dedicated DevTools

## Environment Variables

Local development uses `.env.local` files:

```bash
# API
apps/api/.env.local
DATABASE_URL=postgresql://postgres:password@localhost:5432/cashsouk_dev
JWT_SECRET=dev-secret-change-in-prod

# Frontends (all similar)
apps/landing/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

See [Environment Variables](./environment-variables.md) for complete reference.

## Troubleshooting

### Port Already in Use

```bash
# Find process
lsof -ti:3000

# Kill it
kill -9 $(lsof -ti:3000)
```

### Cannot Find Module

```bash
# Rebuild workspace
pnpm install
pnpm build

# If still failing, clear everything
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

### TypeScript Errors in IDE

```bash
# Restart TypeScript server in VS Code
Cmd+Shift+P → "TypeScript: Restart TS Server"

# Regenerate types
cd apps/api && npx prisma generate
```

### Database Issues

```bash
# Restart PostgreSQL
docker restart cashsouk-postgres

# Reset completely
docker stop cashsouk-postgres
docker rm cashsouk-postgres
make db-up
cd apps/api && npx prisma migrate dev
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/loan-approval

# Make changes, commit often
git add .
git commit -m "feat: add loan approval endpoint"

# Push and create PR
git push -u origin feature/loan-approval
```

### Commit Message Convention

```
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting changes
refactor: code refactoring
test: adding tests
chore: maintenance tasks
```

## Code Quality Checklist

Before committing:
- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] No lint errors (`pnpm lint`)
- [ ] No console.log statements
- [ ] Tests pass (if applicable)
- [ ] Environment variables documented
- [ ] Follows brand guidelines (frontend)
- [ ] API responses follow standard format (backend)

## Next Steps

- Review [Getting Started](./getting-started.md) for initial setup
- Check [Authentication Guide](./authentication.md) for auth implementation
- See [Deployment Guide](../deployment/deployment.md) for production deployment
- Read [Project Structure](../architecture/project-structure.md) for codebase organization

