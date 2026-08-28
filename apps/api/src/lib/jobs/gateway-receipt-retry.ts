import { logger } from "../logger";
import { retryFailedGatewayPaymentReceipts } from "../../modules/payment/receipt/receipt-service";
import { OpsAlertSeverity, OpsAlertType } from "@prisma/client";
import { raiseOpsAlert } from "../../modules/ops-alerts/service";

export async function runGatewayReceiptRetryJob(): Promise<void> {
  const result = await retryFailedGatewayPaymentReceipts();
  if (result.attempted > 0) {
    logger.info(result, "Gateway payment receipt retry job completed");
  }
  if (result.failed > 0) {
    await raiseOpsAlert({
      type: OpsAlertType.RECEIPT_FAILURE,
      severity: OpsAlertSeverity.MEDIUM,
      dedupeKey: "receipt-failure:retry-job",
      title: "Gateway payment receipts still failing",
      summary: `${result.failed} receipt(s) failed after retry`,
      entityType: "job",
      entityId: "gateway-receipt-retry",
      details: result,
    });
  }
}
