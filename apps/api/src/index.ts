import { createApp } from "./app";
import { logger } from "./lib/logger";

const PORT = process.env.PORT || 4000;

const app = createApp();

app.listen(PORT, () => {
  logger.info(`🚀 API server running on http://localhost:${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/healthz`);
});

