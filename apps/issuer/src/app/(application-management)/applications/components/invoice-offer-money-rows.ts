import type { InvoiceFeeDisplay } from "@/lib/facility-fee-display";

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
      label: formatFeeRateLabel("Platform fee", feeDisplay.platformFeeRatePercent),
      amount: feeDisplay.platformFeeAmount,
      kind: "deduction",
    },
  ];

  if (includeFacilityFee) {
    rows.push({
      key: "facility",
      label: formatFeeRateLabel("Facility fee", feeDisplay.facilityFeeRatePercent),
      hint: feeDisplay.facilityFeeFullyCollected ? "Cap already reached" : null,
      amount: feeDisplay.facilityFeeAmount,
      kind: "deduction",
    });
  }

  rows.push({
    key: "net",
    label: "Net disbursement",
    hint: "Estimated until funding closes",
    amount: feeDisplay.netDisbursementAmount,
    kind: "net",
  });

  return rows;
}
