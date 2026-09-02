import { logger } from "../../lib/logger";
import { retryFailedInvestmentNoteCertificates } from "../../modules/notes/investment-note-certificate/service";

export async function runInvestmentNoteCertificateRetryJob(): Promise<void> {
  const result = await retryFailedInvestmentNoteCertificates();
  if (result.attempted > 0) {
    logger.info(result, "Investment note certificate retry job completed");
  }
  if (result.failed > 0) {
    logger.error(result, "Investment note certificates still failing after retry");
  }
}
