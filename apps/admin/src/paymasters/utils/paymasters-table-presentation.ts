import { isPaymasterVerified } from "@cashsouk/types";
import type { PaymasterListItem } from "@cashsouk/types";

export function paymasterVerificationLabel(item: Pick<PaymasterListItem, "verificationStatus">): string {
  return isPaymasterVerified(item.verificationStatus) ? "Verified" : "Unverified";
}
