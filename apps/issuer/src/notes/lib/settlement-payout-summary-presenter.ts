import { formatProfitAccruedCopy, type NoteSettlementPoolSummary } from "@cashsouk/types";

export const ISSUER_SETTLEMENT_PAYOUT_INTRO = "How this repayment was allocated.";

export type IssuerSettlementAllocationLine = {
  key: string;
  label: string;
  value: number;
  description: string;
};

export function issuerSettlementProfitAccrualPeriod(
  settlement: Pick<NoteSettlementPoolSummary, "profitStartDate" | "profitMaturityDate" | "profitDays">
): string | null {
  const copy = formatProfitAccruedCopy({
    startDate: settlement.profitStartDate,
    endDate: settlement.profitMaturityDate,
    profitDays: settlement.profitDays,
  });
  if (!copy) return null;
  return copy.replace(/^Profit accrued:\s*/, "");
}

export function issuerSettlementAllocationLines(
  settlement: NoteSettlementPoolSummary
): IssuerSettlementAllocationLine[] {
  return [
    {
      key: "totalReceived",
      label: "Total received",
      value: settlement.grossReceiptAmount,
      description: "Total repayment recorded for this note.",
    },
    {
      key: "investors",
      label: "Investors",
      value: settlement.investorPoolAmount,
      description: "Principal, net profit, and any investor Ta'widh compensation.",
    },
    {
      key: "serviceFee",
      label: "Service fee",
      value: settlement.operatingAccountAmount,
      description: "Service fee retained by the platform.",
    },
    {
      key: "tawidh",
      label: "Ta'widh",
      value: settlement.tawidhAccountAmount,
      description:
        settlement.tawidhInvestorAmount > 0.005
          ? "Ta'widh allocated from this settlement. Any investor share is included in Investors."
          : "Total Ta'widh charged / allocated.",
    },
    {
      key: "gharamah",
      label: "Gharamah",
      value: settlement.gharamahAccountAmount,
      description: "Approved charity / penalty allocation.",
    },
    {
      key: "issuerResidual",
      label: "Issuer residual",
      value: settlement.issuerResidualAmount,
      description: "Remaining amount refundable to the issuer after settlement allocation.",
    },
  ];
}
