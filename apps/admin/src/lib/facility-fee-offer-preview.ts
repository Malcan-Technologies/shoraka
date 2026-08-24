import {
  computeFacilityFeeTotalOwed,
  FACILITY_FEE_RATE_MAX_PERCENT,
  isNoteMoneyAmount,
  parseFiniteNumber,
  roundNoteMoney,
} from "@cashsouk/types";

export type FacilityFeeOfferSplit = {
  totalFacilityFee: number;
  upfrontAmount: number;
  remainingForDrawdown: number;
};

export type SendContractOfferPayload = {
  offeredFacility: number;
  facilityFeeRatePercent: number | null;
  facilityFeeUpfrontCollectAmount: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatSeedMoney(value: number): string {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseFacilityFeeRatePercentInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

const COMPLETE_MONEY_RE = /^-?\d+(\.\d+)?$/;

export function parseFacilityFeeUpfrontInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const numeric = trimmed.replace(/,/g, "");
  if (!COMPLETE_MONEY_RE.test(numeric)) return null;
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveFacilityFeeOfferSplit(input: {
  offeredFacility: number;
  facilityFeeRatePercent: number | null;
  upfrontCollectAmount: number;
}): FacilityFeeOfferSplit {
  const totalFacilityFee = computeFacilityFeeTotalOwed(
    input.offeredFacility,
    input.facilityFeeRatePercent ?? 0
  );
  const upfrontAmount = roundNoteMoney(Math.max(0, input.upfrontCollectAmount));
  return {
    totalFacilityFee,
    upfrontAmount,
    remainingForDrawdown: Math.max(0, roundNoteMoney(totalFacilityFee - upfrontAmount)),
  };
}

export const FACILITY_FEE_RATE_FIELD_TOOLTIP =
  `0% to ${FACILITY_FEE_RATE_MAX_PERCENT}%, up to 2 decimal places. The full fee is owed when the issuer accepts the facility offer. Collection timing is at CashSouk discretion.`;

export const FACILITY_FEE_UPFRONT_FIELD_TOOLTIP =
  "Amount the issuer must pay through the payment gateway after accepting this offer. Enter 0 if no upfront payment is required. The rest is collected on later drawdowns.";

export const FACILITY_FEE_UPFRONT_REQUIRED_MESSAGE =
  "Enter how much to collect upfront. Use 0 if none should be taken now.";

export function validateFacilityFeeUpfrontCollectAmount(input: {
  rawInput: string;
  upfrontCollectAmount: number | null;
  totalFacilityFee: number;
}): string | null {
  if (input.rawInput.trim() === "") {
    return input.totalFacilityFee > 0 ? FACILITY_FEE_UPFRONT_REQUIRED_MESSAGE : null;
  }
  if (input.upfrontCollectAmount == null) {
    return "Upfront amount must be a valid number";
  }
  if (input.upfrontCollectAmount < 0) {
    return "Upfront amount cannot be negative";
  }
  if (!isNoteMoneyAmount(input.upfrontCollectAmount)) {
    return "Upfront amount can have up to 2 decimal places";
  }
  if (input.upfrontCollectAmount - input.totalFacilityFee > 1e-9) {
    return "Upfront amount cannot be more than the total facility fee";
  }
  return null;
}

export function seedFacilityFeeUpfrontInput(offerDetails: unknown): string {
  const record = asRecord(offerDetails);
  const snapshotted = parseFiniteNumber(record?.facility_fee_upfront_collect_amount);
  if (snapshotted == null) return "";
  return formatSeedMoney(Math.max(0, snapshotted));
}

export function buildSendContractOfferPayload(input: {
  offeredFacility: number;
  facilityFeeRatePercent: number | null;
  upfrontCollectAmount: number;
}): SendContractOfferPayload {
  return {
    offeredFacility: input.offeredFacility,
    facilityFeeRatePercent: input.facilityFeeRatePercent,
    facilityFeeUpfrontCollectAmount: roundNoteMoney(Math.max(0, input.upfrontCollectAmount)),
  };
}

/** Empty input is RM0. Any non-empty unparsable/partial/negative value is null. */
export function resolveUpfrontCollectAmountForSubmit(rawInput: string): number | null {
  const parsed = parseFacilityFeeUpfrontInput(rawInput);
  if (parsed == null || parsed < 0) return null;
  return roundNoteMoney(parsed);
}
