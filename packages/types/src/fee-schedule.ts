import {
  isNoteMoneyAmount,
  NOTE_DEFAULT_MINIMUM_FUNDING_PERCENT,
  NOTE_MONEY_TOLERANCE,
} from "./note-money";
import { roundNoteMoney } from "./note-expected-return";

export const INVOICE_FEE_SCHEDULE_VERSION = 1;
export const INVOICE_FEE_SCHEDULE_VERSION_KEY = "fee_schedule_version";

export const NOTE_FEE_OVERRIDE_VERSION = 1;
export const NOTE_FEE_OVERRIDE_KEY = "fee_schedule_overrides";

export const FACILITY_FEE_RATE_MAX_PERCENT = 1;
export const FEE_SCHEDULE_MAX_ADDITIONAL_LINES = 10;
export const FEE_SCHEDULE_MAX_NAME_LENGTH = 80;

export const ADDITIONAL_FEE_KINDS = ["amount", "percent_of_funded"] as const;
export type AdditionalFeeKind = (typeof ADDITIONAL_FEE_KINDS)[number];

export type AdditionalFeeLine = {
  name: string;
  kind: AdditionalFeeKind;
  value: number;
};

export type InvoiceFeeSchedule = {
  version: number;
  facilityFeeCollectAmount: number;
  additionalFees: AdditionalFeeLine[];
};

export type AdditionalFeeCharge = AdditionalFeeLine & {
  chargedAmount: number;
};

export type FacilityFeeCollectionWaiver = {
  version: number;
  facilityFeeCollectionWaived: boolean;
  waivedAt: string | null;
  waivedByUserId: string | null;
  waivedReason: string | null;
};

export type FacilityFeeBalance = {
  totalOwed: number;
  paid: number;
  waived: boolean;
  waivedAmount: number;
  remaining: number;
  enabled: boolean;
  disabledReason: string | null;
};

export type FeeLineValidationIssue = {
  path: string;
  message: string;
};

export type DisbursementFeeSettlement = {
  mode: "schedule" | "grandfather";
  drawdownFee: number;
  facilityFeeCharged: number;
  facilityFeeCap: number;
  facilityFeePaidBefore: number;
  facilityFeeRemainingAfter: number;
  additionalFeeCharges: AdditionalFeeCharge[];
  netDisbursement: number;
  facilityFeeCollectionWaived: boolean;
  contractFacilityFeeWaived: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value != null && typeof value === "object" && "toNumber" in value) {
    const parsed = (value as { toNumber: () => unknown }).toNumber();
    if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/**
 * Actual extra-fee charges stored on issuer-disbursement withdrawal metadata.
 * Omits the field when metadata is missing or every row is invalid (backward compatible).
 */
export function parseAdditionalFeeCharges(value: unknown): AdditionalFeeCharge[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const charges: AdditionalFeeCharge[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name : "";
    const kind =
      row.kind === "percent_of_funded" ? "percent_of_funded" : row.kind === "amount" ? "amount" : null;
    const feeValue = parseFiniteNumber(row.value);
    const chargedAmount = parseFiniteNumber(row.chargedAmount);
    if (!name || !kind || feeValue == null || chargedAmount == null) continue;
    charges.push({ name, kind, value: feeValue, chargedAmount });
  }
  return charges.length > 0 ? charges : undefined;
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;
}

function isAdditionalFeeKind(value: unknown): value is AdditionalFeeKind {
  return value === "amount" || value === "percent_of_funded";
}

export function isFacilityEnabled(details: unknown): boolean {
  const record = asRecord(details);
  if (!record || !("facility_enabled" in record)) return true;
  return record.facility_enabled !== false;
}

export function hasInvoiceFeeSchedule(offerDetails: unknown): boolean {
  const record = asRecord(offerDetails);
  if (!record || !(INVOICE_FEE_SCHEDULE_VERSION_KEY in record)) return false;
  const version = parseFiniteNumber(record[INVOICE_FEE_SCHEDULE_VERSION_KEY]);
  return version != null && Number.isInteger(version) && version >= 1;
}

/** How the send-offer API writes utilisation fees. New offers and existing v1 always use `v1`. */
export const INVOICE_OFFER_FEE_SCHEDULE_WRITE_MODES = ["v1", "preserve_grandfather"] as const;
export type InvoiceOfferFeeScheduleWriteMode =
  (typeof INVOICE_OFFER_FEE_SCHEDULE_WRITE_MODES)[number];

export function isInvoiceOfferFeeScheduleWriteMode(
  value: unknown
): value is InvoiceOfferFeeScheduleWriteMode {
  return value === "v1" || value === "preserve_grandfather";
}

/**
 * True when `offer_details` is a previously sent utilisation offer, including
 * grandfather rows that have no `fee_schedule_version`.
 */
export function isExistingInvoiceOfferDetails(offerDetails: unknown): boolean {
  const record = asRecord(offerDetails);
  if (!record) return false;
  if (hasInvoiceFeeSchedule(record)) return true;
  if (typeof record.sent_at === "string" && record.sent_at.trim() !== "") return true;
  const version = parseFiniteNumber(record.version);
  if (version != null && Number.isInteger(version) && version >= 1) return true;
  return parseFiniteNumber(record.offered_amount) != null;
}

/** Previously sent offer with no v1 marker — progressive facility-fee terms. */
export function isGrandfatherInvoiceOfferDetails(offerDetails: unknown): boolean {
  return isExistingInvoiceOfferDetails(offerDetails) && !hasInvoiceFeeSchedule(offerDetails);
}

export type ResolveInvoiceFeeScheduleWriteModeResult =
  | { ok: true; mode: InvoiceOfferFeeScheduleWriteMode }
  | { ok: false; code: string; message: string };

/**
 * Backend source of truth for whether send writes a v1 schedule.
 * Omitted mode preserves grandfather; it never creates a new grandfather offer.
 */
export function resolveInvoiceFeeScheduleWriteMode(input: {
  requestedMode?: InvoiceOfferFeeScheduleWriteMode | null;
  previousOfferDetails: unknown;
}): ResolveInvoiceFeeScheduleWriteModeResult {
  const previousIsV1 = hasInvoiceFeeSchedule(input.previousOfferDetails);
  const previousIsGrandfather = isGrandfatherInvoiceOfferDetails(input.previousOfferDetails);

  if (input.requestedMode === "preserve_grandfather") {
    if (previousIsV1) {
      return {
        ok: false,
        code: "FEE_SCHEDULE_MODE_INVALID",
        message: "A versioned fee schedule cannot be reverted to grandfather progressive terms",
      };
    }
    if (!previousIsGrandfather) {
      return {
        ok: false,
        code: "FEE_SCHEDULE_MODE_INVALID",
        message: "New invoice offers must use the current fee schedule",
      };
    }
    return { ok: true, mode: "preserve_grandfather" };
  }

  if (input.requestedMode === "v1") {
    return { ok: true, mode: "v1" };
  }

  if (previousIsGrandfather) {
    return { ok: true, mode: "preserve_grandfather" };
  }
  return { ok: true, mode: "v1" };
}

export function validateAdditionalFeeLines(lines: unknown): {
  ok: boolean;
  lines: AdditionalFeeLine[];
  issues: FeeLineValidationIssue[];
} {
  const issues: FeeLineValidationIssue[] = [];
  if (lines == null) {
    return { ok: true, lines: [], issues };
  }
  if (!Array.isArray(lines)) {
    return {
      ok: false,
      lines: [],
      issues: [{ path: "additionalFees", message: "Additional fees must be an array" }],
    };
  }
  if (lines.length > FEE_SCHEDULE_MAX_ADDITIONAL_LINES) {
    issues.push({
      path: "additionalFees",
      message: `At most ${FEE_SCHEDULE_MAX_ADDITIONAL_LINES} additional fee lines are allowed`,
    });
  }

  const parsed: AdditionalFeeLine[] = [];
  const seenNames = new Set<string>();
  for (let index = 0; index < lines.length; index += 1) {
    const raw = asRecord(lines[index]);
    const pathPrefix = `additionalFees.${index}`;
    if (!raw) {
      issues.push({ path: pathPrefix, message: "Each additional fee must be an object" });
      continue;
    }
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) {
      issues.push({ path: `${pathPrefix}.name`, message: "Fee name is required" });
    } else if (name.length > FEE_SCHEDULE_MAX_NAME_LENGTH) {
      issues.push({
        path: `${pathPrefix}.name`,
        message: `Fee name must be at most ${FEE_SCHEDULE_MAX_NAME_LENGTH} characters`,
      });
    } else {
      const nameKey = name.toLowerCase();
      if (seenNames.has(nameKey)) {
        issues.push({ path: `${pathPrefix}.name`, message: "Fee names must be unique" });
      } else {
        seenNames.add(nameKey);
      }
    }

    if (!isAdditionalFeeKind(raw.kind)) {
      issues.push({
        path: `${pathPrefix}.kind`,
        message: 'Fee kind must be "amount" or "percent_of_funded"',
      });
    }

    const value = parseFiniteNumber(raw.value);
    if (value == null || value < 0) {
      issues.push({
        path: `${pathPrefix}.value`,
        message: "Fee value must be a non-negative number",
      });
    } else if (raw.kind === "amount") {
      if (!isNoteMoneyAmount(value)) {
        issues.push({
          path: `${pathPrefix}.value`,
          message: "Amount fees can have up to 2 decimal places",
        });
      }
    } else if (raw.kind === "percent_of_funded") {
      if (value > 100) {
        issues.push({
          path: `${pathPrefix}.value`,
          message: "Percent fees cannot exceed 100",
        });
      }
      if (!hasAtMostTwoDecimals(value)) {
        issues.push({
          path: `${pathPrefix}.value`,
          message: "Percent fees can have up to 2 decimal places",
        });
      }
    }

    if (
      name &&
      name.length <= FEE_SCHEDULE_MAX_NAME_LENGTH &&
      isAdditionalFeeKind(raw.kind) &&
      value != null &&
      value >= 0
    ) {
      parsed.push({ name, kind: raw.kind, value });
    }
  }

  return { ok: issues.length === 0, lines: parsed, issues };
}

export function validateFacilityFeeCollectAmount(value: unknown): {
  ok: boolean;
  amount: number;
  issues: FeeLineValidationIssue[];
} {
  if (value == null || value === "") {
    return { ok: true, amount: 0, issues: [] };
  }
  const amount = parseFiniteNumber(value);
  if (amount == null || amount < 0) {
    return {
      ok: false,
      amount: 0,
      issues: [
        {
          path: "facilityFeeCollectAmount",
          message: "Facility fee collection must be a non-negative amount",
        },
      ],
    };
  }
  if (!isNoteMoneyAmount(amount)) {
    return {
      ok: false,
      amount,
      issues: [
        {
          path: "facilityFeeCollectAmount",
          message: "Facility fee collection can have up to 2 decimal places",
        },
      ],
    };
  }
  return { ok: true, amount, issues: [] };
}

export type InspectedInvoiceFeeSchedule =
  | { present: false; ok: true; schedule: null; issues: [] }
  | {
      present: true;
      ok: boolean;
      schedule: InvoiceFeeSchedule;
      issues: FeeLineValidationIssue[];
    };

/**
 * Display-safe parse. Missing collect is RM 0. Invalid extra lines are dropped.
 * Use `inspectInvoiceFeeSchedule` at charge time so a damaged v1 schedule fails closed.
 */
export function inspectInvoiceFeeSchedule(offerDetails: unknown): InspectedInvoiceFeeSchedule {
  if (!hasInvoiceFeeSchedule(offerDetails)) {
    return { present: false, ok: true, schedule: null, issues: [] };
  }
  const record = asRecord(offerDetails);
  if (!record) {
    return { present: false, ok: true, schedule: null, issues: [] };
  }
  const version = parseFiniteNumber(record[INVOICE_FEE_SCHEDULE_VERSION_KEY]) ?? INVOICE_FEE_SCHEDULE_VERSION;
  const collect = validateFacilityFeeCollectAmount(record.facility_fee_collect_amount);
  const additional = validateAdditionalFeeLines(record.additional_fees);
  const issues = [...collect.issues, ...additional.issues];
  return {
    present: true,
    ok: collect.ok && additional.ok,
    schedule: {
      version: Number.isInteger(version) ? version : INVOICE_FEE_SCHEDULE_VERSION,
      facilityFeeCollectAmount: collect.ok ? collect.amount : 0,
      additionalFees: additional.lines,
    },
    issues,
  };
}

export function parseInvoiceFeeSchedule(offerDetails: unknown): InvoiceFeeSchedule | null {
  const inspected = inspectInvoiceFeeSchedule(offerDetails);
  return inspected.present ? inspected.schedule : null;
}

export function buildInvoiceFeeScheduleOfferPatch(schedule: {
  facilityFeeCollectAmount: number;
  additionalFees: AdditionalFeeLine[];
}): Record<string, unknown> {
  return {
    [INVOICE_FEE_SCHEDULE_VERSION_KEY]: INVOICE_FEE_SCHEDULE_VERSION,
    facility_fee_collect_amount: schedule.facilityFeeCollectAmount,
    additional_fees: schedule.additionalFees.map((line) => ({
      name: line.name,
      kind: line.kind,
      value: line.value,
    })),
  };
}

export function parseFacilityFeeCollectionWaiver(
  invoiceSnapshot: unknown
): FacilityFeeCollectionWaiver | null {
  const snapshot = asRecord(invoiceSnapshot);
  const override = asRecord(snapshot?.[NOTE_FEE_OVERRIDE_KEY]);
  if (!override) return null;
  const version = parseFiniteNumber(override.version) ?? NOTE_FEE_OVERRIDE_VERSION;
  if (!Number.isInteger(version) || version < 1) return null;
  return {
    version,
    facilityFeeCollectionWaived: override.facility_fee_collection_waived === true,
    waivedAt: typeof override.waived_at === "string" ? override.waived_at : null,
    waivedByUserId:
      typeof override.waived_by_user_id === "string" ? override.waived_by_user_id : null,
    waivedReason: typeof override.waived_reason === "string" ? override.waived_reason : null,
  };
}

export function buildFacilityFeeCollectionWaiverPatch(input: {
  waivedByUserId: string;
  waivedReason: string;
  waivedAt?: string;
}): Record<string, unknown> {
  return {
    version: NOTE_FEE_OVERRIDE_VERSION,
    facility_fee_collection_waived: true,
    waived_at: input.waivedAt ?? new Date().toISOString(),
    waived_by_user_id: input.waivedByUserId,
    waived_reason: input.waivedReason,
  };
}

export function computeFacilityFeeTotalOwed(
  approvedFacilityAmount: number,
  facilityFeeRatePercent: number
): number {
  const approved = parseFiniteNumber(approvedFacilityAmount) ?? 0;
  const rate = parseFiniteNumber(facilityFeeRatePercent) ?? 0;
  if (approved <= 0 || rate < 0) return 0;
  return roundNoteMoney(approved * (rate / 100));
}

export function resolveFacilityFeeBalance(details: unknown): FacilityFeeBalance {
  const record = asRecord(details) ?? {};
  const paid = Math.max(0, parseFiniteNumber(record.facility_fee_paid_amount) ?? 0);
  const waived = record.facility_fee_waived === true;
  const storedWaivedAmount = Math.max(0, parseFiniteNumber(record.facility_fee_waived_amount) ?? 0);
  const hasTotal = "facility_fee_total_amount" in record;
  const approved = parseFiniteNumber(record.approved_facility) ?? 0;
  const rate = parseFiniteNumber(record.facility_fee_rate_percent) ?? 0;
  const totalOwed = hasTotal
    ? Math.max(0, parseFiniteNumber(record.facility_fee_total_amount) ?? 0)
    : computeFacilityFeeTotalOwed(approved, rate);
  const waivedAmount = waived ? (storedWaivedAmount > 0 ? storedWaivedAmount : Math.max(0, totalOwed - paid)) : 0;
  const remaining = waived ? 0 : Math.max(0, roundNoteMoney(totalOwed - paid));
  const disabledReason =
    typeof record.facility_disabled_reason === "string" && record.facility_disabled_reason.trim()
      ? record.facility_disabled_reason.trim()
      : null;
  return {
    totalOwed,
    paid,
    waived,
    waivedAmount,
    remaining,
    enabled: isFacilityEnabled(record),
    disabledReason,
  };
}

export function computeDrawdownFee(fundedAmount: number, platformFeeRatePercent: number): number {
  const funded = Math.max(0, parseFiniteNumber(fundedAmount) ?? 0);
  const rate = Math.max(0, parseFiniteNumber(platformFeeRatePercent) ?? 0);
  return roundNoteMoney(funded * (rate / 100));
}

export function computeAdditionalFeeAmount(line: AdditionalFeeLine, fundedAmount: number): number {
  const funded = Math.max(0, parseFiniteNumber(fundedAmount) ?? 0);
  if (line.kind === "amount") {
    return roundNoteMoney(Math.max(0, line.value));
  }
  return roundNoteMoney(funded * (Math.max(0, line.value) / 100));
}

export function computeScheduleFeesAtFundedAmount(input: {
  fundedAmount: number;
  platformFeeRatePercent: number;
  facilityFeeCollectAmount: number;
  additionalFees: AdditionalFeeLine[];
  facilityFeeRemaining?: number;
  facilityFeeCollectionWaived?: boolean;
}): {
  drawdownFee: number;
  facilityFee: number;
  additionalFeeCharges: AdditionalFeeCharge[];
  totalFees: number;
  net: number;
} {
  const funded = Math.max(0, parseFiniteNumber(input.fundedAmount) ?? 0);
  const drawdownFee = computeDrawdownFee(funded, input.platformFeeRatePercent);
  const additionalFeeCharges = input.additionalFees.map((line) => ({
    ...line,
    chargedAmount: computeAdditionalFeeAmount(line, funded),
  }));
  const additionalSum = additionalFeeCharges.reduce((sum, line) => sum + line.chargedAmount, 0);
  const remaining = Math.max(0, parseFiniteNumber(input.facilityFeeRemaining) ?? Number.POSITIVE_INFINITY);
  const facilityFee = input.facilityFeeCollectionWaived
    ? 0
    : Math.min(Math.max(0, input.facilityFeeCollectAmount), remaining);
  const totalFees = roundNoteMoney(drawdownFee + facilityFee + additionalSum);
  return {
    drawdownFee,
    facilityFee: roundNoteMoney(facilityFee),
    additionalFeeCharges,
    totalFees,
    net: roundNoteMoney(funded - totalFees),
  };
}

export function isDisbursementNetNegative(netDisbursement: number): boolean {
  return netDisbursement + NOTE_MONEY_TOLERANCE < 0;
}

export function feesExceedFundedAmount(input: {
  fundedAmount: number;
  platformFeeRatePercent: number;
  facilityFeeCollectAmount: number;
  additionalFees: AdditionalFeeLine[];
}): boolean {
  const result = computeScheduleFeesAtFundedAmount({
    ...input,
    facilityFeeRemaining: Number.POSITIVE_INFINITY,
  });
  return isDisbursementNetNegative(result.net);
}

export function isNoteOpenForFacilityFeeCollectionWaiver(input: {
  status: string;
  fundingStatus: string;
}): boolean {
  return (
    (input.status === "DRAFT" && input.fundingStatus === "NOT_OPEN") ||
    (input.status === "PUBLISHED" && input.fundingStatus === "OPEN")
  );
}

export function offerFeesExceedFundingThresholds(input: {
  offeredAmount: number;
  platformFeeRatePercent: number;
  facilityFeeCollectAmount: number;
  additionalFees: AdditionalFeeLine[];
  minimumFundingPercent?: number;
}): { exceedsAtFull: boolean; exceedsAtMinimum: boolean } {
  const offered = Math.max(0, input.offeredAmount);
  const minPercent = input.minimumFundingPercent ?? NOTE_DEFAULT_MINIMUM_FUNDING_PERCENT;
  const minFunded = roundNoteMoney(offered * (minPercent / 100));
  const shared = {
    platformFeeRatePercent: input.platformFeeRatePercent,
    facilityFeeCollectAmount: input.facilityFeeCollectAmount,
    additionalFees: input.additionalFees,
  };
  return {
    exceedsAtFull: feesExceedFundedAmount({ ...shared, fundedAmount: offered }),
    exceedsAtMinimum: feesExceedFundedAmount({ ...shared, fundedAmount: minFunded }),
  };
}

function capChargesToFunded(input: {
  fundedAmount: number;
  drawdownFee: number;
  facilityFee: number;
  additionalFeeCharges: AdditionalFeeCharge[];
}): {
  drawdownFee: number;
  facilityFee: number;
  additionalFeeCharges: AdditionalFeeCharge[];
  netDisbursement: number;
} {
  const funded = Math.max(0, input.fundedAmount);
  let remainingNet = funded;

  const drawdownFee = Math.min(Math.max(0, input.drawdownFee), remainingNet);
  remainingNet = roundNoteMoney(remainingNet - drawdownFee);

  const additionalFeeCharges = input.additionalFeeCharges.map((line) => {
    const chargedAmount = Math.min(Math.max(0, line.chargedAmount), remainingNet);
    remainingNet = roundNoteMoney(remainingNet - chargedAmount);
    return { ...line, chargedAmount };
  });

  const facilityFee = Math.min(Math.max(0, input.facilityFee), remainingNet);
  remainingNet = roundNoteMoney(remainingNet - facilityFee);

  return {
    drawdownFee: roundNoteMoney(drawdownFee),
    facilityFee: roundNoteMoney(facilityFee),
    additionalFeeCharges,
    netDisbursement: Math.max(0, remainingNet),
  };
}

export function settleDisbursementFees(input: {
  fundedAmount: number;
  platformFeeRatePercent: number;
  offerDetails: unknown;
  invoiceSnapshot?: unknown;
  approvedFacilityAmount: number;
  facilityFeeRatePercent: number;
  facilityFeePaidBefore: number;
  contractDetails?: unknown;
  /** Outstanding still-collectible v1 reservations. Caps grandfather only. */
  reservedFacilityFeeCollect?: number;
}): DisbursementFeeSettlement {
  const fundedAmount = Math.max(0, parseFiniteNumber(input.fundedAmount) ?? 0);
  const drawdownFee = computeDrawdownFee(fundedAmount, input.platformFeeRatePercent);
  const balance = resolveFacilityFeeBalance({
    ...(asRecord(input.contractDetails) ?? {}),
    approved_facility: input.approvedFacilityAmount,
    facility_fee_rate_percent: input.facilityFeeRatePercent,
    facility_fee_paid_amount: input.facilityFeePaidBefore,
  });
  const waiver = parseFacilityFeeCollectionWaiver(input.invoiceSnapshot);
  const noteWaived = waiver?.facilityFeeCollectionWaived === true;
  const schedule = parseInvoiceFeeSchedule(input.offerDetails);

  if (!schedule) {
    const rate = Math.max(0, parseFiniteNumber(input.facilityFeeRatePercent) ?? 0);
    const rawFacilityFee = roundNoteMoney(fundedAmount * (rate / 100));
    const remainingBefore = balance.remaining;
    const reserved = Math.max(0, parseFiniteNumber(input.reservedFacilityFeeCollect) ?? 0);
    const uncommittedRemaining = Math.max(0, roundNoteMoney(remainingBefore - reserved));
    const facilityFeeCharged = Math.max(0, Math.min(rawFacilityFee, uncommittedRemaining));
    const capped = capChargesToFunded({
      fundedAmount,
      drawdownFee,
      facilityFee: facilityFeeCharged,
      additionalFeeCharges: [],
    });
    return {
      mode: "grandfather",
      drawdownFee: capped.drawdownFee,
      facilityFeeCharged: capped.facilityFee,
      facilityFeeCap: balance.totalOwed,
      facilityFeePaidBefore: balance.paid,
      facilityFeeRemainingAfter: roundNoteMoney(Math.max(0, remainingBefore - capped.facilityFee)),
      additionalFeeCharges: [],
      netDisbursement: capped.netDisbursement,
      facilityFeeCollectionWaived: false,
      contractFacilityFeeWaived: balance.waived,
    };
  }

  const computed = computeScheduleFeesAtFundedAmount({
    fundedAmount,
    platformFeeRatePercent: input.platformFeeRatePercent,
    facilityFeeCollectAmount: schedule.facilityFeeCollectAmount,
    additionalFees: schedule.additionalFees,
    // Un-waived v1 charges the frozen RM. Callers must reject if remaining is short.
    facilityFeeRemaining: noteWaived || balance.waived ? 0 : Number.POSITIVE_INFINITY,
    facilityFeeCollectionWaived: noteWaived || balance.waived,
  });
  return {
    mode: "schedule",
    drawdownFee: computed.drawdownFee,
    facilityFeeCharged: computed.facilityFee,
    facilityFeeCap: balance.totalOwed,
    facilityFeePaidBefore: balance.paid,
    facilityFeeRemainingAfter: roundNoteMoney(Math.max(0, balance.remaining - computed.facilityFee)),
    additionalFeeCharges: computed.additionalFeeCharges,
    netDisbursement: computed.net,
    facilityFeeCollectionWaived: noteWaived,
    contractFacilityFeeWaived: balance.waived,
  };
}
