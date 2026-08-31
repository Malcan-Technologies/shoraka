import { logger } from "../logger";
import { retryFailedGatewayPaymentReceipts } from "../../modules/payment/receipt/receipt-service";

export async function runGatewayReceiptRetryJob(): Promise<void> {
  const result = await retryFailedGatewayPaymentReceipts();
  if (result.attempted > 0) {
    logger.info(result, "Gateway payment receipt retry job completed");
  }
  if (result.failed > 0) {
    logger.error(result, "Gateway payment receipts still failing after retry");
  }
}
