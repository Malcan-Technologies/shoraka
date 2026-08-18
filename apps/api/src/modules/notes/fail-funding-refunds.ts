/**
 * Wallet credits for a failed funding attempt. Each COMMITTED investment is
 * returned at the stored committed amount — the same figure that was debited
 * on commit — not a recalculated remaining or pro-rata share.
 */
export type FailFundingWalletCredit = {
  noteInvestmentId: string;
  investorOrganizationId: string;
  amount: number;
  idempotencyKey: string;
};

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof (value as { toNumber?: () => number }).toNumber === "function") {
    const parsed = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildFailFundingWalletCredits(
  committedInvestments: Array<{
    id: string;
    investor_organization_id: string;
    amount: unknown;
  }>
): FailFundingWalletCredit[] {
  return committedInvestments
    .map((inv) => ({
      noteInvestmentId: inv.id,
      investorOrganizationId: inv.investor_organization_id,
      amount: toNumber(inv.amount),
      idempotencyKey: `investor-balance:release:fail-funding:${inv.id}`,
    }))
    .filter((credit) => credit.amount > 0);
}
