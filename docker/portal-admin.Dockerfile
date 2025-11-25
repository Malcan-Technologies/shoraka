FROM node:20-alpine AS builder

WORKDIR /app

# Accept build argument
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Debug: Print the API URL during build
RUN echo "🔍 Building with NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY turbo.json ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/ui/package.json ./packages/ui/
COPY packages/styles/package.json ./packages/styles/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY packages/icons/package.json ./packages/icons/

RUN pnpm install --frozen-lockfile

COPY apps/admin ./apps/admin
COPY packages/ui ./packages/ui
COPY packages/styles ./packages/styles
COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY packages/icons ./packages/icons

RUN pnpm --filter @cashsouk/admin build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => process.exit(r.statusCode < 500 ? 0 : 1))"

CMD ["node", "apps/admin/server.js"]

