import { format } from "date-fns";
import { getAdminStatusToken } from "./admin-status-token";

export const STATUS_LABEL: Record<string, string> = {
  CREATED: "Awaiting payment",
  PAID: "Paid",
  NAME_CHECK_PENDING: "Name check pending",
  COMPLETED: "Completed",
  HELD: "Needs attention",
  REFUND_INITIATED: "Refund pending",
  REFUNDED: "Refunded",
  FAILED: "Payment failed",
  EXPIRED: "Expired",
};

export const PURPOSE_LABEL: Record<string, string> = {
  INVESTOR_DEPOSIT: "Investor Deposit",
  ISSUER_ONBOARDING_FEE: "Issuer Registration Fee",
  APPLICATION_PROCESSING_FEE: "Application Processing Fee",
};

/**
 * Badge token for payment status (list + detail).
 * PAID is an intermediate Curlec-captured state, not the final Completed success.
 */
export function statusToken(status: string) {
  return getAdminStatusToken(status);
}

/** @deprecated Prefer statusToken with StatusBadge. */
export function statusVariant(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "HELD" || status === "FAILED") return "destructive" as const;
  if (
    status === "NAME_CHECK_PENDING" ||
    status === "REFUND_INITIATED" ||
    status === "PAID"
  ) {
    return "warning" as const;
  }
  if (status === "REFUNDED") return "muted" as const;
  if (status === "EXPIRED") return "destructive" as const;
  if (status === "CREATED") return "info" as const;
  return "outline" as const;
}

export function formatGatewayPaymentDate(value: string) {
  return format(new Date(value), "dd MMM yyyy, h:mm a");
}

/** @deprecated Prefer formatGatewayPaymentDate — kept for existing imports. */
export const formatDate = formatGatewayPaymentDate;
