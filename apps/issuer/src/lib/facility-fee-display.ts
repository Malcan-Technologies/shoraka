import { formatMoneyDisplay } from "@cashsouk/ui";

export type FeeDisplayPhase = "none" | "pending" | "estimated" | "charged";

export type InvoiceFeeDisplayInput = {
  status?: string | null;
  offerDetails?: Record<string, unknown> | null;
  financingAmount?: unknown;
  isContractFinancing?: boolean;
  contractFacilityFeeRatePercent?: unknown;
  contractFacilityFeeCapAmount?: unknown;
  contractFacilityFeePaidAmount?: unknown;
  actual?: {
    grossFundedAmount?: unknown;
    platformFeeAmount?: unknown;
    facilityFeeCharged?: unknown;
    netIssuerDisbursement?: unknown;
  } | null;
};

export type InvoiceFeeDisplay = {
  phase: FeeDisplayPhase;
  platformFeeAmount: number | null;
  platformFeeRatePercent: number | null;
  facilityFeeAmount: number | null;
  facilityFeeRatePercent: number | null;
  netDisbursementAmount: number | null;
  facilityFeeFullyCollected: boolean;
};

const FAILED_STATUSES = new Set([
  "REJECTED",
  "WITHDRAWN",
  "DECLINED",
  "FAILED",
  "FAILED_FUNDING",
  "UNSUCCESSFUL",
  "CANCELLED",
  "EXPIRED",
]);

const CHARGED_NOTE_STATUSES = new Set(["ACTIVE", "REPAID", "COMPLETED", "DISBURSED"]);

export function money(value: unknown): string {
  return formatMoneyDisplay(value, "—");
}

export function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatPercent(value: unknown): string | null {
  const n = numberOrNull(value);
  if (n == null) return null;
  return `${Number.isInteger(n) ? n : Number(n.toFixed(2))}%`;
}

export function isFailedFeeStatus(status: unknown): boolean {
  return FAILED_STATUSES.has(String(status ?? "").toUpperCase());
}

export function isChargedFeeStatus(status: unknown, actual?: InvoiceFeeDisplayInput["actual"]): boolean {
  if (numberOrNull(actual?.netIssuerDisbursement) != null) return true;
  return CHARGED_NOTE_STATUSES.has(String(status ?? "").toUpperCase());
}

export function buildContractFacilityFeeText(input: {
  ratePercent?: unknown;
  capAmount?: unknown;
  approvedFacilityAmount?: unknown;
}): string | null {
  const rate = numberOrNull(input.ratePercent);
  const cap =
    numberOrNull(input.capAmount) ??
    ((numberOrNull(input.approvedFacilityAmount) != null && rate != null)
      ? (numberOrNull(input.approvedFacilityAmount) as number) * (rate / 100)
      : null);
  const rateText = formatPercent(rate);
  if (!rateText || cap == null || rate == null || rate <= 0) return null;
  return `Facility fee: ${rateText} capped at ${money(cap)}`;
}

export function buildInvoiceFeeDisplay(input: InvoiceFeeDisplayInput): InvoiceFeeDisplay {
  if (isFailedFeeStatus(input.status)) {
    return emptyFeeDisplay("none");
  }

  const offer = input.offerDetails;
  const offeredAmount = numberOrNull(offer?.offered_amount);
  const financingAmount = numberOrNull(input.financingAmount);
  const grossAmount = numberOrNull(input.actual?.grossFundedAmount) ?? offeredAmount ?? financingAmount;
  const platformRate = numberOrNull(offer?.platform_fee_rate_percent);
  const charged = isChargedFeeStatus(input.status, input.actual);

  if (!offer || grossAmount == null) {
    return emptyFeeDisplay("pending");
  }

  const platformFee =
    charged && numberOrNull(input.actual?.platformFeeAmount) != null
      ? numberOrNull(input.actual?.platformFeeAmount)
      : platformRate != null
        ? grossAmount * (platformRate / 100)
        : null;

  const facilityRate = input.isContractFinancing
    ? numberOrNull(input.contractFacilityFeeRatePercent ?? offer.facility_fee_rate_percent)
    : null;
  const facilityCap = numberOrNull(input.contractFacilityFeeCapAmount);
  const facilityPaid = numberOrNull(input.contractFacilityFeePaidAmount) ?? 0;
  const remainingCap = facilityCap != null ? Math.max(0, facilityCap - facilityPaid) : null;
  const rawFacilityFee =
    input.isContractFinancing && facilityRate != null && facilityRate > 0
      ? grossAmount * (facilityRate / 100)
      : null;
  const estimatedFacilityFee =
    rawFacilityFee != null
      ? remainingCap != null
        ? Math.min(rawFacilityFee, remainingCap)
        : rawFacilityFee
      : null;
  const actualFacilityFee = numberOrNull(input.actual?.facilityFeeCharged);
  const facilityFee =
    input.isContractFinancing
      ? charged && actualFacilityFee != null
        ? actualFacilityFee
        : estimatedFacilityFee
      : null;

  const actualNet = numberOrNull(input.actual?.netIssuerDisbursement);
  const net =
    charged && actualNet != null
      ? actualNet
      : platformFee != null
        ? grossAmount - platformFee - (facilityFee ?? 0)
        : null;

  return {
    phase: charged ? "charged" : "estimated",
    platformFeeAmount: platformFee,
    platformFeeRatePercent: platformRate,
    facilityFeeAmount: facilityFee,
    facilityFeeRatePercent: facilityRate,
    netDisbursementAmount: net,
    facilityFeeFullyCollected: input.isContractFinancing === true && remainingCap === 0,
  };
}

function emptyFeeDisplay(phase: FeeDisplayPhase): InvoiceFeeDisplay {
  return {
    phase,
    platformFeeAmount: null,
    platformFeeRatePercent: null,
    facilityFeeAmount: null,
    facilityFeeRatePercent: null,
    netDisbursementAmount: null,
    facilityFeeFullyCollected: false,
  };
}
