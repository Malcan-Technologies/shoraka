import cron from "node-cron";
import { NotificationService } from "../../modules/notification/service";
import { logger } from "../logger";
import { runOfferExpiryJob } from "./offer-expiry";
import { runCtosKybRetryJob } from "./ctos-kyb-retry";
import { runNoteListingExpiryJob } from "./note-listing-expiry";
import { runGatewayStuckOrderPollerJob } from "./gateway-stuck-order-poller";
import { runGatewaySettlementReconJob } from "./gateway-settlement-recon";
import { JOB_LOCK_KEYS, withAdvisoryLock } from "./with-advisory-lock";

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

  // Note listing expiry: auto-close marketplace listings past their scheduled close time.
  // Listings meeting minimum funding are funded; the rest fail and release commitments.
  cron.schedule("0 * * * *", async () => {
    logger.info("Starting note listing expiry job...");
    try {
      const result = await runNoteListingExpiryJob();
      if (
        result.notesAutoFunded.length > 0 ||
        result.notesAutoFailed.length > 0 ||
        result.errors.length > 0
      ) {
        logger.info(
          {
            notesAutoFunded: result.notesAutoFunded.length,
            notesAutoFailed: result.notesAutoFailed.length,
            errors: result.errors.length,
          },
          "Note listing expiry job completed"
        );
      }
    } catch (error) {
      logger.error({ error }, "Failed to run note listing expiry job");
    }
  });

  // Gateway stuck-order poller: recover missed webhooks or expire abandoned checkouts.
  cron.schedule("*/15 * * * *", async () => {
    await withAdvisoryLock(JOB_LOCK_KEYS.GATEWAY_STUCK_ORDER_POLLER, async () => {
      try {
        await runGatewayStuckOrderPollerJob();
      } catch (error) {
        logger.error({ error }, "Failed to run gateway stuck-order poller");
      }
    });
  });

  // Daily Curlec settlement recon at 02:00 MYT (18:00 UTC).
  cron.schedule("0 18 * * *", async () => {
    await withAdvisoryLock(JOB_LOCK_KEYS.GATEWAY_SETTLEMENT_RECON, async () => {
      try {
        await runGatewaySettlementReconJob();
      } catch (error) {
        logger.error({ error }, "Failed to run gateway settlement recon job");
      }
    });
  });

  logger.info("Background jobs initialized");
}
