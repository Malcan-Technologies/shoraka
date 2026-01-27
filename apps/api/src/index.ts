// Load environment variables from .env files in development
// In production, env vars are injected by ECS/container orchestration
import "dotenv/config";

import { logger } from "./lib/logger";
import type { Server } from "http";

const PORT = process.env.PORT || 4000;

// Store server instance for graceful shutdown
let server: Server | null = null;

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
    
    // Increase connection limit to handle concurrent requests during sign-in
    // 20 connections should handle peak load (sign-in can use 5-10 connections concurrently)
    const connectionLimit = process.env.DB_CONNECTION_LIMIT || "20";
    
    process.env.DATABASE_URL = `postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public&connection_limit=${connectionLimit}&${sslMode}`;
    
    logger.info(`📊 Database URL constructed from environment variables`);
    logger.info(`🔌 Connecting to: ${DB_HOST}:${DB_PORT}/${DB_NAME} (connection_limit=${connectionLimit})`);
  }
}

async function main(): Promise<void> {
  // IMPORTANT: Set DATABASE_URL before importing ./app
  // The Prisma client reads DATABASE_URL at module evaluation time
  ensureDatabaseUrl();

  // Dynamic import AFTER env setup - this ensures Prisma sees the DATABASE_URL
  const { createApp } = await import("./app");

  const app = await createApp();

  server = app.listen(PORT, () => {
    logger.info(`🚀 API server running on http://localhost:${PORT}`);
    logger.info(`📊 Health check: http://localhost:${PORT}/healthz`);

    // Log auth bypass status
    if (process.env.DISABLE_AUTH === "true" && process.env.NODE_ENV !== "production") {
      logger.warn("🔓 DEVELOPMENT MODE: Authentication bypass is ENABLED for admin routes");
      logger.warn("⚠️  This should NEVER be enabled in production!");
    } else {
      logger.info("🔒 Authentication is REQUIRED for admin routes");
    }
  });

  // Handle server errors
  server.on("error", (error: Error) => {
    logger.error({ error, stack: error.stack }, "Server error");
  });
}

/**
 * Graceful shutdown handler
 * Closes HTTP server and database connections cleanly
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Received shutdown signal, starting graceful shutdown");

  // Import prisma here to avoid reading DATABASE_URL before it's set
  const { prisma } = await import("./lib/prisma");

  if (server) {
    return new Promise((resolve) => {
      server!.close(() => {
        logger.info("HTTP server closed");

        // Disconnect Prisma
        prisma
          .$disconnect()
          .then(() => {
            logger.info("Database connections closed");
            resolve();
          })
          .catch((error) => {
            logger.error({ error }, "Error closing database connections");
            resolve();
          })
          .finally(() => {
            process.exit(0);
          });
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.warn("Forcing shutdown after timeout");
        process.exit(1);
      }, 10000);
    });
  }

  // If no server, just disconnect Prisma
  await prisma.$disconnect();
  process.exit(0);
}

// Handle unhandled promise rejections
// This prevents the process from crashing on uncaught promise rejections
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  logger.error(
    {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: String(promise),
    },
    "Unhandled Promise Rejection - this may cause server instability"
  );

  // In production, we should log but not exit to prevent cascading failures
  // The error handler middleware will catch these in request context
  if (process.env.NODE_ENV === "production") {
    logger.warn("Continuing despite unhandled rejection (production mode)");
  } else {
    // In development, exit to catch issues early
    logger.error("Exiting due to unhandled rejection (development mode)");
    process.exit(1);
  }
});

// Handle uncaught exceptions
// These are synchronous errors that weren't caught
process.on("uncaughtException", (error: Error) => {
  logger.error(
    {
      error: error.message,
      stack: error.stack,
    },
    "Uncaught Exception - this will cause the process to exit"
  );

  // Attempt graceful shutdown
  gracefulShutdown("uncaughtException").catch(() => {
    process.exit(1);
  });
});

// Handle termination signals from ECS/container orchestrator
process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  gracefulShutdown("SIGTERM").catch(() => {
    process.exit(1);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received");
  gracefulShutdown("SIGINT").catch(() => {
    process.exit(1);
  });
});

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
