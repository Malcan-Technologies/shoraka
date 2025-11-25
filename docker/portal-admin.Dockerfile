FROM node:20-alpine AS builder

WORKDIR /app

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

# Accept build argument right before using it
ARG NEXT_PUBLIC_API_URL

# Clean Next.js cache and build with explicit environment variable
RUN echo "🧹 Cleaning Next.js cache..." && \
    rm -rf apps/admin/.next && \
    echo "🚀 Building with NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}" && \
    echo "🔍 Verifying ARG is set: ${NEXT_PUBLIC_API_URL:-NOT_SET}" && \
    if [ -z "${NEXT_PUBLIC_API_URL}" ]; then echo "❌ ERROR: NEXT_PUBLIC_API_URL is empty!" && exit 1; fi && \
    echo "📝 Creating .env.production file..." && \
    echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}" > apps/admin/.env.production && \
    cat apps/admin/.env.production && \
    echo "🔨 Running build..." && \
    pnpm --filter @cashsouk/admin build && \
    echo "✅ Build complete" && \
    echo "🔍 Checking built files for localhost..." && \
    (grep -r "localhost:4000" apps/admin/.next/static apps/admin/.next/server 2>/dev/null && echo "⚠️ WARNING: localhost:4000 found!") || echo "✅ No localhost:4000 in build"

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

