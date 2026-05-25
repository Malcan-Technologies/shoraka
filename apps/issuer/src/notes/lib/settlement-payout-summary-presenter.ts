import type { IssuerResidualPayoutListStatus } from "@cashsouk/types";

export type SettlementPayoutSummaryTone = "emerald" | "amber";

export function issuerSettlementPayoutSummaryFromResidualStatus(
  payout: IssuerResidualPayoutListStatus
): {
  tone: SettlementPayoutSummaryTone;
  badgeLabel: string;
  blurb: string;
} {
  if (payout.kind === "pending") {
    return {
      tone: "amber",
      badgeLabel: payout.withTrustee ? "Trustee payout" : "Payout in progress",
      blurb: payout.withTrustee
        ? "Posted allocation below. Your residual is still being paid via the trustee; it is not complete until that payout is marked paid."
        : "Posted allocation below. Your residual payout is still in progress.",
    };
  }
  if (payout.kind === "awaiting") {
    return {
      tone: "amber",
      badgeLabel: "Residual outstanding",
      blurb:
        "Posted allocation below. Your residual has not been sent yet; admin will initiate the trustee withdrawal.",
    };
  }
  return {
    tone: "emerald",
    badgeLabel: "Settled",
    blurb: "Posted settlement allocation below.",
  };
}
