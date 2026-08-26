import { formatCurrency } from "@cashsouk/config";
import {
  isSoukscoreRiskRating,
  parseInvoiceFeeSchedule,
  resolveNoteTimingDisplay,
  type NoteDetail,
} from "@cashsouk/types";

export type NoteCommercialTermRow = {
  label: string;
  value: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getRiskRating(note: NoteDetail) {
  const offerDetails = asRecord(note.invoiceSnapshot?.offer_details);
  const riskRating = offerDetails?.risk_rating;
  return isSoukscoreRiskRating(riskRating) ? riskRating : "—";
}

function getFacilityFeeDisplay(note: NoteDetail): string | null {
  const schedule =
    note.feeSchedule ?? parseInvoiceFeeSchedule(asRecord(note.invoiceSnapshot)?.offer_details);
  if (schedule) {
    if (!(schedule.facilityFeeCollectAmount > 0)) return null;
    return `${formatCurrency(schedule.facilityFeeCollectAmount)} at disbursement`;
  }

  const disbursement = note.withdrawals?.find(
    (withdrawal) => withdrawal.withdrawalType === "ISSUER_DISBURSEMENT"
  );
  const chargedAmount = numberOrNull(disbursement?.facilityFeeCharged);
  if (chargedAmount != null && chargedAmount > 0) {
    return `${formatCurrency(chargedAmount)} at disbursement`;
  }

  const contract = asRecord(note.contractSnapshot);
  const contractDetails = asRecord(contract?.contract_details);
  const rate = numberOrNull(contractDetails?.facility_fee_rate_percent);
  if (rate == null || rate <= 0) return null;

  const approvedFacility = numberOrNull(contractDetails?.approved_facility);
  const paidAmount = numberOrNull(contractDetails?.facility_fee_paid_amount) ?? 0;
  const cap = approvedFacility != null ? approvedFacility * (rate / 100) : null;
  const remainingCap = cap != null ? Math.max(0, cap - paidAmount) : null;
  const baseAmount = numberOrNull(note.fundedAmount) ?? numberOrNull(note.targetAmount);
  if (baseAmount == null || baseAmount <= 0) return null;

  const rawFee = baseAmount * (rate / 100);
  const estimatedFee = remainingCap != null ? Math.min(rawFee, remainingCap) : rawFee;
  if (estimatedFee <= 0) return null;
  return `${formatCurrency(estimatedFee)} at disbursement`;
}

function extraFeeValue(line: { kind: "amount" | "percent_of_funded"; value: number }): string {
  return line.kind === "percent_of_funded"
    ? `${line.value}% of funds raised`
    : `${formatCurrency(line.value)} at disbursement`;
}

/** Commercial terms for the note header and terms card. Invoice amount is omitted — it equals settlement amount. */
export function getNoteCommercialTermRows(note: NoteDetail): NoteCommercialTermRow[] {
  const timing = resolveNoteTimingDisplay(note);
  const rows: NoteCommercialTermRow[] = [
    { label: "Paymaster", value: note.paymasterName?.trim() || "—" },
    { label: "Risk rating", value: getRiskRating(note) },
    {
      label: "Profit rate",
      value: note.profitRatePercent == null ? "—" : `${note.profitRatePercent}% p.a.`,
    },
    { label: "Drawdown fee", value: `${note.platformFeeRatePercent}% at disbursement` },
  ];
  if (note.facilityFeeCollectionWaiver?.facilityFeeCollectionWaived) {
    rows.push({ label: "Facility fee", value: "Collection waived for this note" });
  } else {
    const facilityFeeDisplay = getFacilityFeeDisplay(note);
    if (facilityFeeDisplay) {
      rows.push({ label: "Facility fee", value: facilityFeeDisplay });
    }
  }
  const extraFees = note.feeSchedule?.additionalFees ?? [];
  for (const line of extraFees) {
    rows.push({ label: line.name, value: extraFeeValue(line) });
  }
  if (timing.isTenureNote) {
    rows.push({
      label: "Financing tenure",
      value: timing.kind === "tenure_pending" ? timing.value : `${timing.tenureDays} days`,
    });
  }
  rows.push(
    { label: "Service fee", value: `${note.serviceFeeRatePercent}% of investor profit` },
    {
      label: "Late caps",
      value: `Ta'widh ${note.tawidhRateCapPercent}%, Gharamah ${note.gharamahRateCapPercent}%`,
    }
  );
  return rows;
}
