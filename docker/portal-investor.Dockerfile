FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY apps/investor/package.json ./apps/investor/
COPY packages/ui/package.json ./packages/ui/
COPY packages/styles/package.json ./packages/styles/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY packages/icons/package.json ./packages/icons/

RUN pnpm install --frozen-lockfile

COPY apps/investor ./apps/investor
COPY packages/ui ./packages/ui
COPY packages/styles ./packages/styles
COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY packages/icons ./packages/icons

RUN pnpm --filter @shoraka/investor build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/investor/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/investor/.next/static ./apps/investor/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/investor/public ./apps/investor/public

USER nextjs

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002', (r) => process.exit(r.statusCode < 500 ? 0 : 1))"

CMD ["node", "apps/investor/server.js"]

