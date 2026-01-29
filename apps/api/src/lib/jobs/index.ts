import cron from 'node-cron';
import { NotificationService } from '../../modules/notification/service';
import { logger } from '../logger';

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

  logger.info('Background jobs initialized');
}
