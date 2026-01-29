import "dotenv/config";
import { NotificationService } from "../src/modules/notification/service";
import { logger } from "../src/lib/logger";

async function main() {
  logger.info("Starting manual notification cleanup script...");
  const notificationService = new NotificationService();

  try {
    await notificationService.runCleanup();
    logger.info("Manual notification cleanup completed successfully.");
  } catch (error) {
    logger.error({ error }, "Manual notification cleanup failed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
