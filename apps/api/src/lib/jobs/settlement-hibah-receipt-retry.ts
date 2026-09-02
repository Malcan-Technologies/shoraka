import { logger } from "../../lib/logger";
import { retryFailedSettlementHibahReceipts } from "../../modules/notes/settlement-hibah-receipt/service";

export async function runSettlementHibahReceiptRetryJob(): Promise<void> {
  const result = await retryFailedSettlementHibahReceipts();
  if (result.attempted > 0) {
    logger.info(result, "Settlement hibah receipt retry job completed");
  }
  if (result.failed > 0) {
    logger.error(result, "Settlement hibah receipts still failing after retry");
  }
}
