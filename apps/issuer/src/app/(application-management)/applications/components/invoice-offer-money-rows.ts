import type { InvoiceFeeDisplay } from "@/lib/facility-fee-display";
import { formatAdditionalFeeLabel } from "@/lib/facility-fee-display";

export type InvoiceOfferMoneyRowKind = "base" | "deduction" | "net";

export type InvoiceOfferMoneyRow = {
  key: string;
  label: string;
  hint?: string | null;
  amount: number | null;
  kind: InvoiceOfferMoneyRowKind;
};

export function formatFeeRateLabel(base: string, ratePercent: number | null): string {
  if (ratePercent == null || !Number.isFinite(ratePercent)) return base;
  const display = Number.isInteger(ratePercent)
    ? String(ratePercent)
    : String(Math.round(ratePercent * 100) / 100);
  return `${base} (${display}%)`;
}

function facilityFeeHint(feeDisplay: InvoiceFeeDisplay): string | null {
  if (feeDisplay.facilityFeeCollectionWaived) {
    return feeDisplay.waiverReason
      ? `Collection waived for this drawdown: ${feeDisplay.waiverReason}`
      : "Collection waived for this drawdown";
  }
  if (feeDisplay.contractFacilityFeeWaived) {
    return "Facility fee waived";
  }
  if (feeDisplay.mode === "schedule") {
    if (feeDisplay.facilityFeeFullyCollected && (feeDisplay.facilityFeeAmount ?? 0) === 0) {
      return "No remaining facility fee";
    }
    return "Exact collection amount";
  }
  if (feeDisplay.facilityFeeFullyCollected) return "Cap already reached";
  return null;
}

function netHint(feeDisplay: InvoiceFeeDisplay): string | null {
  if (feeDisplay.phase === "charged") return "Based on actual funded amount";
  if (feeDisplay.mode === "schedule") {
    return "Estimated at full funding. Final uses actual funded.";
  }
  return "Estimated until funding closes";
}

export function buildInvoiceOfferMoneyRows(input: {
  requestedFinancing: number | null;
  approvedFinancing: number | null;
  includeFacilityFee: boolean;
  feeDisplay: InvoiceFeeDisplay;
}): InvoiceOfferMoneyRow[] {
  const { requestedFinancing, approvedFinancing, includeFacilityFee, feeDisplay } = input;
  const rows: InvoiceOfferMoneyRow[] = [
    { key: "requested", label: "Requested financing", amount: requestedFinancing, kind: "base" },
    { key: "approved", label: "Approved financing", amount: approvedFinancing, kind: "base" },
    {
      key: "platform",
      label: formatFeeRateLabel("Drawdown fee", feeDisplay.platformFeeRatePercent),
      hint:
        feeDisplay.phase !== "charged" && feeDisplay.estimatedFromOfferedAmount
          ? "Estimated from offered amount. Final uses actual funded."
          : null,
      amount: feeDisplay.platformFeeAmount,
      kind: "deduction",
    },
  ];

  if (includeFacilityFee) {
    rows.push({
      key: "facility",
      label:
        feeDisplay.mode === "schedule"
          ? "Facility fee"
          : formatFeeRateLabel("Facility fee", feeDisplay.facilityFeeRatePercent),
      hint: facilityFeeHint(feeDisplay),
      amount: feeDisplay.facilityFeeAmount,
      kind: "deduction",
    });
  }

  feeDisplay.additionalFeeCharges.forEach((line, index) => {
    rows.push({
      key: `extra-${index}`,
      label: formatAdditionalFeeLabel(line),
      hint:
        line.kind === "percent_of_funded" && feeDisplay.phase !== "charged"
          ? "% of actual funded. Estimated here from the offered amount."
          : line.kind === "amount"
            ? "Fixed amount, unchanged at partial funding"
            : null,
      amount: line.chargedAmount,
      kind: "deduction",
    });
  });

  rows.push({
    key: "net",
    label: "Net disbursement",
    hint: netHint(feeDisplay),
    amount: feeDisplay.netDisbursementAmount,
    kind: "net",
  });

  return rows;
}
