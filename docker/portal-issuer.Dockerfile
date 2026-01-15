FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY turbo.json ./
COPY apps/issuer/package.json ./apps/issuer/
COPY apps/api/package.json ./apps/api/
COPY packages/ui/package.json ./packages/ui/
COPY packages/styles/package.json ./packages/styles/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY packages/icons/package.json ./packages/icons/

RUN pnpm install --frozen-lockfile

COPY apps/issuer ./apps/issuer
COPY apps/api/prisma ./apps/api/prisma
COPY packages/ui ./packages/ui
COPY packages/styles ./packages/styles
COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY packages/icons ./packages/icons

RUN pnpm --filter @cashsouk/api prisma generate

# Build-time environment variables for portal URLs
ARG NEXT_PUBLIC_INVESTOR_URL=https://investor.cashsouk.com
ARG NEXT_PUBLIC_ISSUER_URL=https://issuer.cashsouk.com
ARG NEXT_PUBLIC_ADMIN_URL=https://admin.cashsouk.com
ARG NEXT_PUBLIC_LANDING_URL=https://www.cashsouk.com
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_COGNITO_USER_POOL_ID
ARG NEXT_PUBLIC_COGNITO_CLIENT_ID
ARG NEXT_PUBLIC_COGNITO_REGION
ARG NEXT_PUBLIC_COGNITO_DOMAIN=auth.cashsouk.com
ARG NEXT_PUBLIC_COOKIE_DOMAIN=.cashsouk.com

RUN rm -rf apps/issuer/.next && \
    echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}" > apps/issuer/.env.production && \
    echo "NEXT_PUBLIC_LANDING_URL=${NEXT_PUBLIC_LANDING_URL}" >> apps/issuer/.env.production && \
    echo "NEXT_PUBLIC_INVESTOR_URL=${NEXT_PUBLIC_INVESTOR_URL}" >> apps/issuer/.env.production && \
    echo "NEXT_PUBLIC_ADMIN_URL=${NEXT_PUBLIC_ADMIN_URL}" >> apps/issuer/.env.production && \
    echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=${NEXT_PUBLIC_COGNITO_USER_POOL_ID}" >> apps/issuer/.env.production && \
    echo "NEXT_PUBLIC_COGNITO_CLIENT_ID=${NEXT_PUBLIC_COGNITO_CLIENT_ID}" >> apps/issuer/.env.production && \
    echo "NEXT_PUBLIC_COGNITO_DOMAIN=${NEXT_PUBLIC_COGNITO_DOMAIN}" >> apps/issuer/.env.production && \
    echo "NEXT_PUBLIC_COGNITO_REGION=${NEXT_PUBLIC_COGNITO_REGION}" >> apps/issuer/.env.production && \
    echo "NEXT_PUBLIC_COOKIE_DOMAIN=${NEXT_PUBLIC_COOKIE_DOMAIN}" >> apps/issuer/.env.production && \
    echo "📝 Building issuer portal..." && \
    pnpm --filter @cashsouk/issuer build && \
    echo "✅ Issuer portal built successfully"

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/issuer/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/issuer/.next/static ./apps/issuer/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/issuer/public ./apps/issuer/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/issuer/server.js"]

