FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY turbo.json ./
COPY apps/issuer/package.json ./apps/issuer/
COPY packages/ui/package.json ./packages/ui/
COPY packages/styles/package.json ./packages/styles/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY packages/icons/package.json ./packages/icons/

RUN pnpm install --frozen-lockfile

COPY apps/issuer ./apps/issuer
COPY packages/ui ./packages/ui
COPY packages/styles ./packages/styles
COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY packages/icons ./packages/icons

ARG NEXT_PUBLIC_API_URL

RUN rm -rf apps/issuer/.next && \
    if [ -z "${NEXT_PUBLIC_API_URL}" ]; then echo "❌ ERROR: NEXT_PUBLIC_API_URL is empty!" && exit 1; fi && \
    echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}" > apps/issuer/.env.production && \
    pnpm --filter @cashsouk/issuer build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache curl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/issuer/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/issuer/.next/static ./apps/issuer/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/issuer/public ./apps/issuer/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "apps/issuer/server.js"]

