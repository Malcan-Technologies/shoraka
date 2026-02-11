FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Create .npmrc to enable hoisting
RUN echo "shamefully-hoist=true" > .npmrc
RUN echo "public-hoist-pattern[]=*" >> .npmrc

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages/types ./packages/types
COPY packages/config ./packages/config

RUN cd apps/api && pnpm prisma generate
RUN pnpm --filter @cashsouk/api build

FROM node:20-alpine AS runner

WORKDIR /app

# Install OpenSSL for Prisma and curl for downloading RDS certificate
RUN apk add --no-cache openssl curl

# Download AWS RDS global CA certificate bundle
# This is required for SSL connections to RDS
RUN curl -sSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /app/rds-ca-cert.pem \
    && chmod 644 /app/rds-ca-cert.pem

ENV NODE_ENV=production
ENV PORT=4000

# Copy workspace structure
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/.npmrc ./.npmrc

# Copy all node_modules from builder (already contains all dependencies + Prisma client)
COPY --from=builder /app/node_modules ./node_modules

# Copy built API code
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copy workspace packages (for TypeScript resolution)
COPY --from=builder /app/packages ./packages

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiuser

RUN chown -R apiuser:nodejs /app

USER apiuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "require('http').get('http://localhost:4000/healthz', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "apps/api/dist/index.js"]

