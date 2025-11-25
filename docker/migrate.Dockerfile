# Migration-only Docker image
# Used for running Prisma migrations in production without race conditions
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Create .npmrc to enable hoisting
RUN echo "shamefully-hoist=true" > .npmrc
RUN echo "public-hoist-pattern[]=*" >> .npmrc

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile

COPY apps/api/prisma ./apps/api/prisma
COPY packages ./packages

# Generate Prisma Client
RUN cd apps/api && pnpm prisma generate

# Runner stage
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install PostgreSQL client and OpenSSL for Prisma
RUN apk add --no-cache postgresql-client openssl

# Copy workspace files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema and migrations
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages ./packages

# Copy migration script
COPY docker/migrate.sh /app/migrate.sh
RUN chmod +x /app/migrate.sh

CMD ["/app/migrate.sh"]

