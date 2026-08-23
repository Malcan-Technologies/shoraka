import { formatMoneyDisplay } from "@cashsouk/ui";
import {
  computeScheduleFeesAtFundedAmount,
  hasInvoiceFeeSchedule,
  parseFacilityFeeCollectionWaiver,
  parseInvoiceFeeSchedule,
  resolveFacilityFeeBalance,
  type AdditionalFeeCharge,
  type AdditionalFeeKind,
} from "@cashsouk/types";

export type FeeDisplayPhase = "none" | "pending" | "estimated" | "charged";
export type InvoiceFeeDisplayMode = "none" | "schedule" | "grandfather";

export type InvoiceFeeActualBreakdown = {
  grossFundedAmount?: unknown;
  platformFeeAmount?: unknown;
  facilityFeeCharged?: unknown;
  netIssuerDisbursement?: unknown;
  additionalFees?: AdditionalFeeCharge[] | null;
  facilityFeeCollectionWaived?: boolean;
};

export type InvoiceFeeDisplayInput = {
  status?: string | null;
  offerDetails?: Record<string, unknown> | null;
  financingAmount?: unknown;
  isContractFinancing?: boolean;
  contractFacilityFeeRatePercent?: unknown;
  contractFacilityFeeCapAmount?: unknown;
  contractFacilityFeePaidAmount?: unknown;
  contractDetails?: unknown;
  invoiceSnapshot?: unknown;
  actual?: InvoiceFeeActualBreakdown | null;
};

export type InvoiceFeeDisplay = {
  phase: FeeDisplayPhase;
  mode: InvoiceFeeDisplayMode;
  platformFeeAmount: number | null;
  platformFeeRatePercent: number | null;
  facilityFeeAmount: number | null;
  facilityFeeRatePercent: number | null;
  facilityFeeCollectAmount: number | null;
  additionalFeeCharges: AdditionalFeeCharge[];
  netDisbursementAmount: number | null;
  facilityFeeFullyCollected: boolean;
  facilityFeeCollectionWaived: boolean;
  contractFacilityFeeWaived: boolean;
  waiverReason: string | null;
  estimatedFromOfferedAmount: boolean;
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

export function formatAdditionalFeeLabel(line: {
  name: string;
  kind: AdditionalFeeKind;
  value: number;
}): string {
  if (line.kind === "percent_of_funded") {
    const rate = formatPercent(line.value);
    return rate ? `${line.name} (${rate})` : line.name;
  }
  return line.name;
}

export function isFailedFeeStatus(status: unknown): boolean {
  return FAILED_STATUSES.has(String(status ?? "").toUpperCase());
}

export function isChargedFeeStatus(
  status: unknown,
  actual?: InvoiceFeeDisplayInput["actual"]
): boolean {
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
    (numberOrNull(input.approvedFacilityAmount) != null && rate != null
      ? (numberOrNull(input.approvedFacilityAmount) as number) * (rate / 100)
      : null);
  const rateText = formatPercent(rate);
  if (!rateText || cap == null || rate == null || rate <= 0) return null;
  return `Facility fee: ${rateText} owed in full (${money(cap)}). Collection at Shoraka's discretion.`;
}

export function buildInvoiceFeeDisplay(input: InvoiceFeeDisplayInput): InvoiceFeeDisplay {
  if (isFailedFeeStatus(input.status)) {
    return emptyFeeDisplay("none");
  }

  const offer = input.offerDetails;
  const offeredAmount = numberOrNull(offer?.offered_amount);
  const financingAmount = numberOrNull(input.financingAmount);
  const actualFunded = numberOrNull(input.actual?.grossFundedAmount);
  const basisAmount = actualFunded ?? offeredAmount ?? financingAmount;
  const platformRate = numberOrNull(offer?.platform_fee_rate_percent);
  const charged = isChargedFeeStatus(input.status, input.actual);

  if (!offer || basisAmount == null) {
    return emptyFeeDisplay("pending");
  }

  const waiver = parseFacilityFeeCollectionWaiver(input.invoiceSnapshot);
  const noteWaived =
    waiver?.facilityFeeCollectionWaived === true || input.actual?.facilityFeeCollectionWaived === true;
  const details = asRecord(input.contractDetails) ?? {};
  const balanceInput: Record<string, unknown> = { ...details };
  if (input.contractFacilityFeeRatePercent != null) {
    balanceInput.facility_fee_rate_percent = input.contractFacilityFeeRatePercent;
  }
  if (input.contractFacilityFeeCapAmount != null) {
    balanceInput.facility_fee_total_amount = input.contractFacilityFeeCapAmount;
  }
  if (input.contractFacilityFeePaidAmount != null) {
    balanceInput.facility_fee_paid_amount = input.contractFacilityFeePaidAmount;
  }
  const balance = resolveFacilityFeeBalance(balanceInput);
  const hasFacilityCap =
    input.isContractFinancing === true &&
    (numberOrNull(input.contractFacilityFeeCapAmount) != null ||
      numberOrNull(details.facility_fee_total_amount) != null ||
      (numberOrNull(details.approved_facility) != null &&
        numberOrNull(details.facility_fee_rate_percent ?? input.contractFacilityFeeRatePercent) !=
          null));
  const remainingCap = hasFacilityCap ? balance.remaining : null;

  if (hasInvoiceFeeSchedule(offer)) {
    return buildScheduleFeeDisplay({
      offer,
      basisAmount,
      platformRate,
      charged,
      actual: input.actual,
      isContractFinancing: input.isContractFinancing === true,
      remainingCap,
      noteWaived,
      contractWaived: balance.waived,
      waiverReason: waiver?.waivedReason ?? null,
      estimatedFromOfferedAmount: actualFunded == null,
    });
  }

  return buildGrandfatherFeeDisplay({
    basisAmount,
    platformRate,
    charged,
    actual: input.actual,
    isContractFinancing: input.isContractFinancing === true,
    facilityRate: input.isContractFinancing
      ? numberOrNull(input.contractFacilityFeeRatePercent ?? offer.facility_fee_rate_percent)
      : null,
    remainingCap: input.isContractFinancing ? remainingCap : null,
    contractWaived: balance.waived,
  });
}

function buildScheduleFeeDisplay(input: {
  offer: Record<string, unknown>;
  basisAmount: number;
  platformRate: number | null;
  charged: boolean;
  actual?: InvoiceFeeActualBreakdown | null;
  isContractFinancing: boolean;
  remainingCap: number | null;
  noteWaived: boolean;
  contractWaived: boolean;
  waiverReason: string | null;
  estimatedFromOfferedAmount: boolean;
}): InvoiceFeeDisplay {
  const schedule = parseInvoiceFeeSchedule(input.offer);
  const collectAmount = schedule?.facilityFeeCollectAmount ?? 0;
  const additionalFees = schedule?.additionalFees ?? [];
  const waived = input.noteWaived || input.contractWaived;
  const computed = computeScheduleFeesAtFundedAmount({
    fundedAmount: input.basisAmount,
    platformFeeRatePercent: input.platformRate ?? 0,
    facilityFeeCollectAmount: input.isContractFinancing ? collectAmount : 0,
    additionalFees,
    facilityFeeRemaining: input.remainingCap ?? undefined,
    facilityFeeCollectionWaived: waived,
  });

  const actualDrawdown = numberOrNull(input.actual?.platformFeeAmount);
  const actualFacility = numberOrNull(input.actual?.facilityFeeCharged);
  const actualNet = numberOrNull(input.actual?.netIssuerDisbursement);
  const actualExtra = input.actual?.additionalFees;
  const drawdownFee =
    input.charged && actualDrawdown != null ? actualDrawdown : computed.drawdownFee;
  const facilityFee = input.isContractFinancing
    ? input.charged && actualFacility != null
      ? actualFacility
      : computed.facilityFee
    : null;
  const extra =
    input.charged && actualExtra && actualExtra.length > 0
      ? actualExtra
      : computed.additionalFeeCharges;
  const extraSum = extra.reduce((sum, line) => sum + line.chargedAmount, 0);
  const net =
    input.charged && actualNet != null
      ? actualNet
      : computed.net;

  return {
    phase: input.charged ? "charged" : "estimated",
    mode: "schedule",
    platformFeeAmount: input.platformRate != null ? drawdownFee : null,
    platformFeeRatePercent: input.platformRate,
    facilityFeeAmount: facilityFee,
    facilityFeeRatePercent: null,
    facilityFeeCollectAmount: input.isContractFinancing ? collectAmount : null,
    additionalFeeCharges: extra,
    netDisbursementAmount:
      input.platformRate != null || extraSum > 0 || facilityFee != null ? net : null,
    facilityFeeFullyCollected:
      input.isContractFinancing &&
      !waived &&
      input.remainingCap != null &&
      input.remainingCap <= 0 &&
      collectAmount > 0,
    facilityFeeCollectionWaived: input.noteWaived,
    contractFacilityFeeWaived: input.contractWaived,
    waiverReason: input.noteWaived ? input.waiverReason : null,
    estimatedFromOfferedAmount: input.charged ? false : input.estimatedFromOfferedAmount,
  };
}

function buildGrandfatherFeeDisplay(input: {
  basisAmount: number;
  platformRate: number | null;
  charged: boolean;
  actual?: InvoiceFeeActualBreakdown | null;
  isContractFinancing: boolean;
  facilityRate: number | null;
  remainingCap: number | null;
  contractWaived: boolean;
}): InvoiceFeeDisplay {
  const computedDrawdown =
    input.platformRate != null ? input.basisAmount * (input.platformRate / 100) : null;
  const drawdownFee =
    input.charged && numberOrNull(input.actual?.platformFeeAmount) != null
      ? numberOrNull(input.actual?.platformFeeAmount)
      : computedDrawdown;

  const rawFacilityFee =
    input.isContractFinancing && input.facilityRate != null && input.facilityRate > 0
      ? input.basisAmount * (input.facilityRate / 100)
      : null;
  const estimatedFacilityFee =
    rawFacilityFee != null
      ? input.remainingCap != null
        ? Math.min(rawFacilityFee, input.remainingCap)
        : rawFacilityFee
      : null;
  const actualFacilityFee = numberOrNull(input.actual?.facilityFeeCharged);
  const facilityFee = input.isContractFinancing
    ? input.charged && actualFacilityFee != null
      ? actualFacilityFee
      : estimatedFacilityFee
    : null;

  const actualNet = numberOrNull(input.actual?.netIssuerDisbursement);
  const net =
    input.charged && actualNet != null
      ? actualNet
      : drawdownFee != null
        ? input.basisAmount - drawdownFee - (facilityFee ?? 0)
        : null;

  return {
    phase: input.charged ? "charged" : "estimated",
    mode: "grandfather",
    platformFeeAmount: drawdownFee,
    platformFeeRatePercent: input.platformRate,
    facilityFeeAmount: facilityFee,
    facilityFeeRatePercent: input.facilityRate,
    facilityFeeCollectAmount: null,
    additionalFeeCharges: [],
    netDisbursementAmount: net,
    facilityFeeFullyCollected: input.isContractFinancing && input.remainingCap === 0,
    facilityFeeCollectionWaived: false,
    contractFacilityFeeWaived: input.contractWaived,
    waiverReason: null,
    estimatedFromOfferedAmount: !input.charged,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function emptyFeeDisplay(phase: FeeDisplayPhase): InvoiceFeeDisplay {
  return {
    phase,
    mode: "none",
    platformFeeAmount: null,
    platformFeeRatePercent: null,
    facilityFeeAmount: null,
    facilityFeeRatePercent: null,
    facilityFeeCollectAmount: null,
    additionalFeeCharges: [],
    netDisbursementAmount: null,
    facilityFeeFullyCollected: false,
    facilityFeeCollectionWaived: false,
    contractFacilityFeeWaived: false,
    waiverReason: null,
    estimatedFromOfferedAmount: false,
  };
}
