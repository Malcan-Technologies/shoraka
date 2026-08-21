import type { InvestorBalanceActivityRelated } from "./notes";

function formatEnumLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function withdrawalIdFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const value = metadata?.withdrawalId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function gatewayPaymentIdFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const value = metadata?.gatewayPaymentId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function pendingDepositActivityId(gatewayPaymentId: string): string {
  return `gateway:${gatewayPaymentId}`;
}

export function activityEntryAffectsAvailableBalance(entry: {
  affectsAvailableBalance?: boolean;
}): boolean {
  return entry.affectsAvailableBalance !== false;
}

export function investorActivityTypeLabel(
  source: string,
  metadata: Record<string, unknown> | null
): string {
  if (
    source === "MANUAL_TOPUP" ||
    source === "GATEWAY_DEPOSIT" ||
    source === "GATEWAY_DEPOSIT_REFUND" ||
    source === "GATEWAY_DEPOSIT_REFUND_HOLD"
  ) {
    return "Deposit";
  }
  if (source === "NOTE_INVESTMENT_COMMIT") return "Investment";
  if (source === "NOTE_INVESTMENT_RELEASE") {
    return asRecord(metadata)?.releaseReason === "SETTLEMENT_PAYOUT" ? "Returns" : "Release";
  }
  if (source === "INVESTOR_WITHDRAWAL_REQUEST") return "Withdrawal";
  return formatEnumLabel(source);
}

/** First-glance row title. Filter types stay coarse (`Investment` / `Release`). */
export function investorActivityTitle(
  source: string,
  metadata: Record<string, unknown> | null,
  related: InvestorBalanceActivityRelated | null
): string {
  if (source === "NOTE_INVESTMENT_COMMIT") {
    const status = related?.status ?? "COMMITTED";
    if (status === "CONFIRMED") return "Investment confirmed";
    if (status === "SETTLED") return "Investment settled";
    if (status === "CANCELLED") return "Investment cancelled";
    return "Investment committed";
  }

  if (source === "NOTE_INVESTMENT_RELEASE") {
    return asRecord(metadata)?.releaseReason === "SETTLEMENT_PAYOUT"
      ? "Investment returns"
      : "Investment returned";
  }

  if (source === "INVESTOR_WITHDRAWAL_REQUEST") {
    const status = related?.status ?? "DRAFT";
    if (status === "COMPLETED") return "Withdrawal paid";
    if (status === "CANCELLED") return "Withdrawal cancelled";
    return "Withdrawal requested";
  }

  if (source === "MANUAL_TOPUP" || source === "GATEWAY_DEPOSIT") {
    const status = related?.kind === "deposit" ? related.status : "COMPLETED";
    if (status === "PAID" || status === "NAME_CHECK_PENDING" || status === "HELD") {
      return "Deposit received";
    }
    if (status === "REFUND_INITIATED") return "Deposit refund";
    return "Deposit";
  }

  if (source === "GATEWAY_DEPOSIT_REFUND" || source === "GATEWAY_DEPOSIT_REFUND_HOLD") {
    return "Deposit refund";
  }

  return investorActivityTypeLabel(source, metadata);
}

export type InvestorActivityStatusDisplay = {
  label: string;
  /** Raw status key understood by `getUserPortalStatusToken`. */
  tokenStatus: string;
};

export function investorActivityStatusDisplay(
  source: string,
  related: InvestorBalanceActivityRelated | null,
  metadata: Record<string, unknown> | null = null
): InvestorActivityStatusDisplay | null {
  if (source === "NOTE_INVESTMENT_COMMIT") {
    const status = related?.status ?? "COMMITTED";
    if (status === "CONFIRMED") return { label: "Confirmed", tokenStatus: "CONFIRMED" };
    if (status === "SETTLED") return { label: "Settled", tokenStatus: "SETTLED" };
    if (status === "RELEASED") return { label: "Released", tokenStatus: "RELEASED" };
    if (status === "CANCELLED") return { label: "Cancelled", tokenStatus: "CANCELLED" };
    return { label: "Committed", tokenStatus: "COMMITTED" };
  }

  if (source === "NOTE_INVESTMENT_RELEASE") {
    if (asRecord(metadata)?.releaseReason === "SETTLEMENT_PAYOUT") {
      return { label: "Paid out", tokenStatus: "SETTLED" };
    }
    return { label: "Returned", tokenStatus: "RELEASED" };
  }

  if (source === "INVESTOR_WITHDRAWAL_REQUEST") {
    const status = related?.status ?? "DRAFT";
    if (status === "COMPLETED") return { label: "Paid", tokenStatus: "COMPLETED" };
    if (status === "SUBMITTED_TO_TRUSTEE") return { label: "On the way", tokenStatus: "SUBMITTED" };
    if (status === "LETTER_GENERATED") {
      return { label: "Being processed", tokenStatus: "UNDER_REVIEW" };
    }
    if (status === "CANCELLED") return { label: "Cancelled", tokenStatus: "CANCELLED" };
    return { label: "Awaiting approval", tokenStatus: "PENDING_APPROVAL" };
  }

  if (source === "MANUAL_TOPUP" || source === "GATEWAY_DEPOSIT") {
    const status = related?.kind === "deposit" ? related.status : "COMPLETED";
    if (status === "PAID") return { label: "Processing", tokenStatus: "PAID" };
    if (status === "NAME_CHECK_PENDING") {
      return { label: "Verifying", tokenStatus: "NAME_CHECK_PENDING" };
    }
    if (status === "HELD") return { label: "Needs review", tokenStatus: "HELD" };
    if (status === "REFUND_INITIATED") {
      return { label: "Refunding", tokenStatus: "UNDER_REVIEW" };
    }
    return { label: "Completed", tokenStatus: "COMPLETED" };
  }

  if (source === "GATEWAY_DEPOSIT_REFUND_HOLD") {
    return { label: "Refunding", tokenStatus: "UNDER_REVIEW" };
  }
  if (source === "GATEWAY_DEPOSIT_REFUND") {
    return { label: "Refunded", tokenStatus: "REFUNDED" };
  }

  return null;
}

export function investorActivityStatusDetail(
  source: string,
  related: InvestorBalanceActivityRelated | null
): string | null {
  if (source !== "INVESTOR_WITHDRAWAL_REQUEST") return null;
  const status = related?.status ?? "DRAFT";
  if (status === "COMPLETED") return "Paid to your bank";
  if (status === "SUBMITTED_TO_TRUSTEE") return "Sent to your bank";
  if (status === "LETTER_GENERATED") return "Approved · preparing payout";
  if (status === "CANCELLED") return "This withdrawal was cancelled";
  return "Pending CashSouk approval";
}

export function investorActivityDepositDetail(
  source: string,
  related: InvestorBalanceActivityRelated | null = null
): string | null {
  if (source === "MANUAL_TOPUP") return "Wallet top-up";
  if (source !== "GATEWAY_DEPOSIT") return null;
  const status = related?.kind === "deposit" ? related.status : "COMPLETED";
  if (status === "PAID") return "Online payment · processing";
  if (status === "NAME_CHECK_PENDING") {
    return "Online payment · name verification in progress";
  }
  if (status === "HELD") return "Online payment · under review";
  if (status === "REFUND_INITIATED") return "Online payment · refund in progress";
  return "Online payment";
}

export function runningBalancesForActivityEntries(
  entriesNewestFirst: Array<{
    direction: "IN" | "OUT";
    amount: number;
    affectsAvailableBalance?: boolean;
  }>,
  availableBalance: number
): number[] {
  let running = availableBalance;
  return entriesNewestFirst.map((entry) => {
    const shown = running;
    if (activityEntryAffectsAvailableBalance(entry)) {
      running += entry.direction === "IN" ? -entry.amount : entry.amount;
    }
    return shown;
  });
}
