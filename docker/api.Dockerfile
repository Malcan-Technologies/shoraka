FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages/types ./packages/types
COPY packages/config ./packages/config

RUN cd apps/api && pnpm prisma generate
RUN pnpm --filter @shoraka/api build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiuser

COPY --from=builder --chown=apiuser:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/package.json ./package.json
COPY --from=builder --chown=apiuser:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER apiuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/healthz', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]

