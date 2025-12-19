import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

/**
 * Dev Prisma Client
 * Connects to dev database for testing webhooks in production
 * Uses DATABASE_URL_DEV environment variable if available, otherwise falls back to DATABASE_URL
 */
const getDevDatabaseUrl = (): string => {
  // Use DATABASE_URL_DEV if provided, otherwise use DATABASE_URL
  // This allows testing webhooks in production by writing to dev database
  return process.env.DATABASE_URL_DEV || process.env.DATABASE_URL || "";
};

const devDatabaseUrl = getDevDatabaseUrl();

if (!devDatabaseUrl) {
  logger.warn("⚠️  DATABASE_URL_DEV not set - dev webhook will use DATABASE_URL");
}

const globalForPrismaDev = globalThis as unknown as {
  prismaDev: PrismaClient | undefined;
};

export const prismaDev =
  globalForPrismaDev.prismaDev ??
  new PrismaClient({
    datasources: {
      db: {
        url: devDatabaseUrl,
      },
    },
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrismaDev.prismaDev = prismaDev;
}

// Connect to dev database
prismaDev.$connect().then(() => {
  logger.info("✅ Dev database connected", {
    databaseUrl: devDatabaseUrl.replace(/:[^:@]+@/, ":****@"), // Mask password
  });
}).catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    "Failed to connect to dev database"
  );
});

