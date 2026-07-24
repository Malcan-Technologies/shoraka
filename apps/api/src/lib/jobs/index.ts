import cron from "node-cron";
import { NotificationService } from "../../modules/notification/service";
import { logger } from "../logger";
import { runCtosKybRetryJob } from "./ctos-kyb-retry";
import { runNoteListingExpiryJob } from "./note-listing-expiry";
import { runSigningEnvelopeExpiryJob } from "./signing-envelope-expiry";
import { runAcceptanceSigningExpiryJob } from "./acceptance-signing-expiry";
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

  // Signing envelope expiry: close active envelopes past their explicit expiry timestamp.
  cron.schedule("0 * * * *", async () => {
    await withAdvisoryLock(JOB_LOCK_KEYS.SIGNING_ENVELOPE_EXPIRY, async () => {
      logger.info("Starting signing envelope expiry job...");
      try {
        const result = await runSigningEnvelopeExpiryJob();
        if (result.expiredEnvelopeIds.length > 0) {
          logger.info(
            { expiredEnvelopeCount: result.expiredEnvelopeIds.length },
            "Signing envelope expiry job completed"
          );
        }
      } catch (error) {
        logger.error({ error }, "Failed to run signing envelope expiry job");
      }
    });
  });

  // Acceptance + signing phase deadlines: reminders and durable OFFER_EXPIRED.
  cron.schedule("0 * * * *", async () => {
    await withAdvisoryLock(JOB_LOCK_KEYS.ACCEPTANCE_SIGNING_EXPIRY, async () => {
      logger.info("Starting acceptance/signing expiry job...");
      try {
        const result = await runAcceptanceSigningExpiryJob();
        if (
          result.remindersSent > 0 ||
          result.contractsExpired.length > 0 ||
          result.invoicesExpired.length > 0
        ) {
          logger.info(
            {
              remindersSent: result.remindersSent,
              contractsExpired: result.contractsExpired.length,
              invoicesExpired: result.invoicesExpired.length,
            },
            "Acceptance/signing expiry job completed"
          );
        }
      } catch (error) {
        logger.error({ error }, "Failed to run acceptance/signing expiry job");
      }
    });
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
