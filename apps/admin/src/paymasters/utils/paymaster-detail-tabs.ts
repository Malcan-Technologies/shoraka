import { isPaymasterVerified } from "@cashsouk/types";
import type { StatusToken } from "@cashsouk/ui";
import { adminTabStatusLabel } from "@/lib/admin-status-token";

export const PAYMASTER_DETAIL_TAB_IDS = ["identity", "linked-records", "activity"] as const;
export type PaymasterDetailTabId = (typeof PAYMASTER_DETAIL_TAB_IDS)[number];

export function isPaymasterDetailTabId(value: string): value is PaymasterDetailTabId {
  return (PAYMASTER_DETAIL_TAB_IDS as readonly string[]).includes(value);
}

export function paymasterIdentityTabStatus(verificationStatus: string): {
  statusToken: StatusToken;
  statusLabel: string;
} {
  const statusToken: StatusToken = isPaymasterVerified(verificationStatus) ? "success" : "action";
  return { statusToken, statusLabel: adminTabStatusLabel(statusToken) };
}
