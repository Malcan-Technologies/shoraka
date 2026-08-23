import { isDisbursementNetNegative } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";

export function rejectNegativeDisbursementNet(netDisbursement: number): void {
  if (isDisbursementNetNegative(netDisbursement)) {
    throw new AppError(409, "DISBURSEMENT_NET_NEGATIVE", "Fees would exceed the funded amount");
  }
}
