import { logger } from "../../lib/logger";
import { retryFailedInvestmentSettlementConfirmations } from "../../modules/notes/investment-settlement-confirmation/service";

export async function runInvestmentSettlementConfirmationRetryJob(): Promise<void> {
  const result = await retryFailedInvestmentSettlementConfirmations();
  if (result.attempted > 0) {
    logger.info(result, "Investment settlement confirmation retry job completed");
  }
  if (result.failed > 0) {
    logger.error(result, "Investment settlement confirmations still failing after retry");
  }
}
