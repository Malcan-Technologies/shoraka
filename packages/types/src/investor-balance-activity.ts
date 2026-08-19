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

export function investorActivityTypeLabel(
  source: string,
  metadata: Record<string, unknown> | null
): string {
  if (source === "MANUAL_TOPUP" || source === "GATEWAY_DEPOSIT") return "Deposit";
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

export function investorActivityDepositDetail(source: string): string | null {
  if (source === "MANUAL_TOPUP") return "Wallet top-up";
  if (source === "GATEWAY_DEPOSIT") return "Online payment";
  return null;
}
