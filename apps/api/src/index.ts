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

const app = createApp();

app.listen(PORT, () => {
  logger.info(`🚀 API server running on http://localhost:${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/healthz`);
});

