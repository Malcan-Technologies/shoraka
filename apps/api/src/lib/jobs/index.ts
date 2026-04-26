import cron from "node-cron";
import { NotificationService } from "../../modules/notification/service";
import { logger } from "../logger";
import { runOfferExpiryJob } from "./offer-expiry";
import { runCtosKybRetryJob } from "./ctos-kyb-retry";

const notificationService = new NotificationService();

/**
 * Initialize all scheduled background jobs
 */
export function initJobs() {
  logger.info('Initializing background jobs...');

  // Daily notification cleanup at 00:00
  cron.schedule('0 0 * * *', async () => {
    logger.info('Starting daily notification cleanup job...');
    try {
      await notificationService.runCleanup();
      logger.info('Daily notification cleanup job completed successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to run daily notification cleanup job');
    }
  });

  // Offer expiry: withdraw expired contract/invoice offers. Every hour.
  cron.schedule("0 * * * *", async () => {
    logger.info("Starting offer expiry job...");
    try {
      const result = await runOfferExpiryJob();
      if (result.contractsWithdrawn.length > 0 || result.invoicesWithdrawn.length > 0) {
        logger.info(
          {
            contractsWithdrawn: result.contractsWithdrawn.length,
            invoicesWithdrawn: result.invoicesWithdrawn.length,
            applicationsUpdated: result.applicationsUpdated.length,
          },
          "Offer expiry job completed"
        );
      } else {
        logger.info("Offer expiry job completed (no expired offers found)");
      }
    } catch (error) {
      logger.error({ error }, "Failed to run offer expiry job");
    }
  });

  // CTOS party KYB attach retry: KYC APPROVED but director/shareholder KYB flags incomplete.
  cron.schedule("*/5 * * * *", async () => {
    try {
      await runCtosKybRetryJob();
    } catch (error) {
      logger.error({ error }, "Failed to run CTOS KYB retry job");
    }
  });

  logger.info("Background jobs initialized");
}
