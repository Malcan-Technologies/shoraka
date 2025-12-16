// Load environment variables from .env files in development
// In production, env vars are injected by ECS/container orchestration
import "dotenv/config";

import { createApp } from "./app";
import { logger } from "./lib/logger";

const PORT = process.env.PORT || 4000;

// Construct DATABASE_URL from individual env vars if not provided
// This allows ECS to pass secrets as separate variables
if (!process.env.DATABASE_URL && process.env.DB_HOST) {
  const { DB_HOST, DB_PORT = '5432', DB_USERNAME, DB_PASSWORD, DB_NAME = 'cashsouk' } = process.env;
  process.env.DATABASE_URL = `postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public&connection_limit=5`;
  logger.info(`📊 Database URL constructed from environment variables`);
  logger.info(`🔌 Connecting to: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
}

createApp().then((app) => {
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
  });
}).catch((error) => {
  logger.error({ 
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  }, "Failed to start server");
  console.error("Error details:", error);
  process.exit(1);
});

