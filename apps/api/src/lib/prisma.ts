import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query spam off by default; set PRISMA_LOG_QUERIES=true to re-enable in dev.
    log:
      process.env.NODE_ENV === "development" && process.env.PRISMA_LOG_QUERIES === "true"
        ? ["query", "error", "warn"]
        : process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Connect to database with error handling
prisma.$connect()
  .then(() => {
    logger.info("✅ Database connected");
  })
  .catch((error) => {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "❌ Database connection failed"
    );
    // Don't exit process here - let the health check handle it
    // This allows the API to start and report unhealthy status
  });
