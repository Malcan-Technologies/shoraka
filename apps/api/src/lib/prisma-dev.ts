import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

/**
 * Dev Prisma Client
 * Connects to dev database for testing webhooks in production.
 * Uses DATABASE_URL_DEV environment variable.
 * 
 * This module uses lazy initialization - the Prisma client is only
 * created and connected when getPrismaDevClient() is called.
 */

let prismaDevInstance: PrismaClient | null = null;
let connectionAttempted = false;

/**
 * Get the dev database URL.
 * Only returns a valid URL if DATABASE_URL_DEV is explicitly set.
 * Does NOT fall back to DATABASE_URL or localhost to prevent accidental
 * production database writes.
 */
function getDevDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL_DEV;
  
  if (!url) {
    return null;
  }
  
  return url;
}

/**
 * Get or create the dev Prisma client.
 * Uses lazy initialization to avoid connecting at module load time.
 * Returns null if DATABASE_URL_DEV is not configured.
 */
export async function getPrismaDevClient(): Promise<PrismaClient | null> {
  // Only allow in development, or when explicitly enabled
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_REGTANK_DEV_WEBHOOK !== "true") {
    logger.warn("Dev Prisma client requested in production without ENABLE_REGTANK_DEV_WEBHOOK=true");
    return null;
  }

  const devDatabaseUrl = getDevDatabaseUrl();
  
  if (!devDatabaseUrl) {
    if (!connectionAttempted) {
      logger.warn("⚠️ DATABASE_URL_DEV not set - dev webhook database operations will be skipped");
      connectionAttempted = true;
    }
    return null;
  }

  if (prismaDevInstance) {
    return prismaDevInstance;
  }

  try {
    prismaDevInstance = new PrismaClient({
      datasources: {
        db: {
          url: devDatabaseUrl,
        },
      },
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });

    await prismaDevInstance.$connect();
    
    logger.info("✅ Dev database connected", {
      databaseUrl: devDatabaseUrl.replace(/:[^:@]+@/, ":****@"), // Mask password
    });

    return prismaDevInstance;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to connect to dev database"
    );
    prismaDevInstance = null;
    return null;
  }
}

/**
 * Disconnect the dev Prisma client if connected.
 */
export async function disconnectPrismaDev(): Promise<void> {
  if (prismaDevInstance) {
    await prismaDevInstance.$disconnect();
    prismaDevInstance = null;
    logger.info("Dev database disconnected");
  }
}
