// Load environment variables from .env files in development
// In production, env vars are injected by ECS/container orchestration
import "dotenv/config";

import { logger } from "./lib/logger";

const PORT = process.env.PORT || 4000;

/**
 * Ensure DATABASE_URL is set before importing any modules that use Prisma.
 * This is critical because Prisma reads DATABASE_URL at module evaluation time.
 */
function ensureDatabaseUrl(): void {
  // If DATABASE_URL is already set, we're good
  if (process.env.DATABASE_URL) {
    return;
  }

  // Construct DATABASE_URL from individual env vars if provided
  // This allows ECS to pass secrets as separate variables
  if (process.env.DB_HOST) {
    const { DB_HOST, DB_PORT = "5432", DB_USERNAME, DB_PASSWORD, DB_NAME = "cashsouk" } = process.env;

    // Use SSL in production, prefer SSL otherwise
    const sslMode = process.env.NODE_ENV === "production" ? "sslmode=require" : "sslmode=prefer";

    process.env.DATABASE_URL = `postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public&connection_limit=5&${sslMode}`;

    logger.info(`📊 Database URL constructed from environment variables`);
    logger.info(`🔌 Connecting to: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  }
}

async function main(): Promise<void> {
  // IMPORTANT: Set DATABASE_URL before importing ./app
  // The Prisma client reads DATABASE_URL at module evaluation time
  ensureDatabaseUrl();

  // Dynamic import AFTER env setup - this ensures Prisma sees the DATABASE_URL
  const { createApp } = await import("./app");
  const { initJobs } = await import("./lib/jobs");

  const app = await createApp();
  initJobs();

  app.listen(PORT, () => {
    logger.info(`🚀 API server running on http://localhost:${PORT}`);
    logger.info(`📊 Health check: http://localhost:${PORT}/healthz`);

    // Log auth bypass status
    if (process.env.DISABLE_AUTH === "true" && process.env.NODE_ENV !== "production") {
      logger.warn("🔓 DEVELOPMENT MODE: Authentication bypass is ENABLED for admin routes");
      logger.warn("⚠️  This should NEVER be enabled in production!");
    } else {
      logger.info("🔒 Authentication is REQUIRED for admin routes");
    }

    // Memory monitoring for ECS crash debugging
    // Logs memory usage every 10 seconds to help diagnose memory leaks
    setInterval(() => {
      const m = process.memoryUsage();
      logger.info({
        heapUsedMB: (m.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (m.heapTotal / 1024 / 1024).toFixed(2),
        rssMB: (m.rss / 1024 / 1024).toFixed(2),
      }, "Memory usage");
    }, 10000);

    // Additional memory monitoring with external memory tracking
    // Logs every 5 seconds with heapUsed, rss, and external memory
    setInterval(() => {
      const m = process.memoryUsage();
      logger.info({
        heapUsed: m.heapUsed / 1024 / 1024,
        rss: m.rss / 1024 / 1024,
        external: m.external / 1024 / 1024,
      }, "MEM");
    }, 5000);
  });
}

main().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    "Fatal startup error"
  );
  console.error("Error details:", error);
  process.exit(1);
});
