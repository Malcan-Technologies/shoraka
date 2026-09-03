import {
  computeScheduleFeesAtFundedAmount,
  FEE_SCHEDULE_MAX_ADDITIONAL_LINES,
  hasInvoiceFeeSchedule,
  isExistingInvoiceOfferDetails,
  isGrandfatherInvoiceOfferDetails,
  NOTE_DEFAULT_MINIMUM_FUNDING_PERCENT,
  offerFeesExceedFundingThresholds,
  parseInvoiceFeeSchedule,
  roundNoteMoney,
  validateAdditionalFeeLines,
  validateFacilityFeeCollectAmount,
  type AdditionalFeeKind,
  type AdditionalFeeLine,
  type InvoiceOfferFeeScheduleWriteMode,
  type MarcSmeGrade,
  type ScCompanyCategory,
  type ScSustainabilityCategory,
} from "@cashsouk/types";

export type SendInvoiceOfferUiPayload = {
  invoiceId: string;
  offeredAmount: number;
  offeredRatioPercent: number;
  offeredProfitRatePercent: number;
  platformFeeRatePercent: number;
  risk_rating: MarcSmeGrade;
  company_category: ScCompanyCategory;
  sustainability_category: ScSustainabilityCategory;
  financingTenureDays: number;
  feeScheduleMode: InvoiceOfferFeeScheduleWriteMode;
  facilityFeeCollectAmount: number;
  additionalFees: AdditionalFeeLine[];
};

export type InvoiceOfferFeeEditorMode = "v1" | "grandfather";

export type UtilisationFeeScheduleState = {
  /** Null until admin enters an amount on a new or converted offer. */
  facilityFeeCollectAmount: number | null;
  additionalFees: AdditionalFeeLine[];
};

export type InvoiceOfferFeeEditorState = {
  mode: InvoiceOfferFeeEditorMode;
  schedule: UtilisationFeeScheduleState;
};

export type InvoiceFeeEditorBook = {
  states: Record<string, InvoiceOfferFeeEditorState>;
  fingerprints: Record<string, string>;
};

export type UtilisationFeeTotals = ReturnType<typeof computeScheduleFeesAtFundedAmount>;

export type UtilisationFeeThresholdTotals = {
  full: UtilisationFeeTotals;
  minimum: UtilisationFeeTotals;
  minimumPercent: number;
  exceedsAtFull: boolean;
  exceedsAtMinimum: boolean;
};

export type UtilisationFeeIssue = {
  path: string;
  message: string;
};

export const FACILITY_FEE_AVAILABLE_FOR_OFFER_LABEL = "Available for this offer";
export const FACILITY_FEE_COLLECT_REQUIRED_MESSAGE =
  "Enter the facility fee to collect from this invoice. Use 0 if none should be taken now.";
export const FACILITY_FEE_COLLECT_NONE_LEFT_MESSAGE =
  "No facility fee left to collect on this offer.";
export const FACILITY_FEE_COLLECT_NOW_TOOLTIP =
  "Exact RM amount to take from this invoice toward the facility fee. Frozen after the issuer accepts. Enter 0 if none should be taken now.";
export const ADDITIONAL_FEES_SECTION_TOOLTIP =
  "Optional named lines. Each is a fixed RM amount or a percent of actual funds raised.";
export const CONVERT_TO_CURRENT_FEE_SCHEDULE_LABEL = "Use current fee schedule";
export const INVOICE_OFFER_CONFIRM_REFRESHING_MESSAGE =
  "Refreshing the facility fee available for this offer.";
export const INVOICE_OFFER_CONFIRM_REFRESH_FAILED_MESSAGE =
  "Could not refresh the facility fee available for this offer. Cancel and open Confirm & Send again to retry.";
export const INVOICE_OFFER_CONFIRM_INVOICE_MISSING_MESSAGE =
  "This invoice is no longer available. Cancel and try again.";

export function facilityFeeCollectExceedsAvailableMessage(available: number): string {
  return `Facility fee collection cannot exceed the facility fee available for this offer of ${available.toFixed(2)}`;
}
export const GRANDFATHER_OFFER_FEE_CALLOUT =
  "This offer uses grandfather progressive facility-fee terms (a percent of funds raised at each disbursement). Exact RM collection and additional lines are not frozen. Using the current fee schedule starts at RM 0.00 and does not convert the old progressive rate into a fixed amount.";
export const GRANDFATHER_OFFER_FEE_CONFIRMATION =
  "This offer keeps grandfather progressive facility-fee terms (a percent of funds raised at each disbursement). Exact RM facility collection and additional fee lines will not be frozen.";

export function emptyUtilisationFeeSchedule(): UtilisationFeeScheduleState {
  return { facilityFeeCollectAmount: null, additionalFees: [] };
}

export function resolvedFacilityFeeCollectAmount(
  amount: number | null | undefined
): number {
  return amount ?? 0;
}

/** True when collect is enabled, an amount is still due, and admin has not entered one. */
export function facilityFeeCollectNeedsExplicitAmount(input: {
  collectAmount: number | null;
  collectEnabled?: boolean;
  facilityFeeRemaining?: number;
}): boolean {
  if (input.collectEnabled === false) return false;
  if (input.collectAmount != null) return false;
  return input.facilityFeeRemaining !== 0;
}

export function remainingFacilityFeeAfterCollect(
  available: number | undefined,
  collect: number | null
): number | null {
  if (available == null || collect == null) return null;
  return Math.max(0, roundNoteMoney(available - collect));
}

export function resolveInvoiceOfferFacilityFeeRemaining(invoice: {
  facilityFeeAvailableToReserve?: number | null;
}): number | undefined {
  return invoice.facilityFeeAvailableToReserve ?? undefined;
}

export function invoiceOfferFacilityFeeCollectEnabled(invoice: {
  facilityFeeAvailableToReserve?: number | null;
}): boolean {
  return invoice.facilityFeeAvailableToReserve != null;
}

export function emptyAdditionalFeeLine(): AdditionalFeeLine {
  return { name: "", kind: "amount", value: 0 };
}

export function additionalFeeKindLabel(kind: AdditionalFeeKind): string {
  return kind === "percent_of_funded" ? "% of funds raised" : "Fixed amount (RM)";
}

export function parseOfferFeeSchedule(offerDetails: unknown): UtilisationFeeScheduleState {
  const parsed = parseInvoiceFeeSchedule(offerDetails);
  if (!parsed) {
    return emptyUtilisationFeeSchedule();
  }
  return {
    facilityFeeCollectAmount: parsed.facilityFeeCollectAmount,
    additionalFees: parsed.additionalFees,
  };
}

export function resolveInvoiceOfferFeeEditorMode(offerDetails: unknown): InvoiceOfferFeeEditorMode {
  if (hasInvoiceFeeSchedule(offerDetails)) return "v1";
  if (isGrandfatherInvoiceOfferDetails(offerDetails)) return "grandfather";
  return "v1";
}

export function parseInvoiceOfferFeeEditorState(offerDetails: unknown): InvoiceOfferFeeEditorState {
  const mode = resolveInvoiceOfferFeeEditorMode(offerDetails);
  return {
    mode,
    schedule: mode === "v1" ? parseOfferFeeSchedule(offerDetails) : emptyUtilisationFeeSchedule(),
  };
}

export function convertGrandfatherOfferToCurrentV1(): InvoiceOfferFeeEditorState {
  return { mode: "v1", schedule: emptyUtilisationFeeSchedule() };
}

export function toSendInvoiceOfferFeeFields(editor: InvoiceOfferFeeEditorState): {
  feeScheduleMode: InvoiceOfferFeeScheduleWriteMode;
  facilityFeeCollectAmount: number;
  additionalFees: AdditionalFeeLine[];
} {
  if (editor.mode === "grandfather") {
    return {
      feeScheduleMode: "preserve_grandfather",
      facilityFeeCollectAmount: 0,
      additionalFees: [],
    };
  }
  return {
    feeScheduleMode: "v1",
    facilityFeeCollectAmount: resolvedFacilityFeeCollectAmount(
      editor.schedule.facilityFeeCollectAmount
    ),
    additionalFees: editor.schedule.additionalFees,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Stable fee-field fingerprint so unrelated refetches keep in-progress edits. */
export function invoiceOfferFeeFingerprint(offerDetails: unknown): string {
  const record = asRecord(offerDetails);
  if (!record) return "none";
  return JSON.stringify({
    existing: isExistingInvoiceOfferDetails(record),
    version: record.fee_schedule_version ?? null,
    collect: record.facility_fee_collect_amount ?? null,
    additional: record.additional_fees ?? null,
  });
}

export function resyncInvoiceFeeEditorBook(
  prev: InvoiceFeeEditorBook,
  invoices: Array<{ id: string; offer_details?: unknown }>
): InvoiceFeeEditorBook {
  const states: Record<string, InvoiceOfferFeeEditorState> = {};
  const fingerprints: Record<string, string> = {};
  const seen = new Set<string>();
  let changed = Object.keys(prev.states).length !== invoices.length;
  for (const invoice of invoices) {
    seen.add(invoice.id);
    const fingerprint = invoiceOfferFeeFingerprint(invoice.offer_details);
    fingerprints[invoice.id] = fingerprint;
    if (prev.states[invoice.id] && prev.fingerprints[invoice.id] === fingerprint) {
      states[invoice.id] = prev.states[invoice.id];
    } else {
      states[invoice.id] = parseInvoiceOfferFeeEditorState(invoice.offer_details);
      changed = true;
    }
  }
  for (const id of Object.keys(prev.states)) {
    if (!seen.has(id)) changed = true;
  }
  if (!changed) return prev;
  return { states, fingerprints };
}

export function clampOfferPlatformFeePercent(parsed: number, fallback: number, cap: number): number {
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(cap, Math.max(0, Math.round(parsed * 100) / 100));
}

/** Same rate the send handler posts, including an in-progress drawdown draft. */
export function resolveDrawdownFeeRateForSend(input: {
  committedPercent: number;
  draft: string | undefined;
  capPercent: number;
}): number {
  const committed = clampOfferPlatformFeePercent(input.committedPercent, 0, input.capPercent);
  if (input.draft === undefined) return committed;
  if (input.draft.trim() === "") return 0;
  return clampOfferPlatformFeePercent(
    Number(input.draft.replace(/,/g, "")),
    committed,
    input.capPercent
  );
}

export function summariseUtilisationFees(input: {
  offeredAmount: number;
  platformFeeRatePercent: number;
  schedule: UtilisationFeeScheduleState;
  facilityFeeRemaining?: number;
  facilityFeeCollectionWaived?: boolean;
  minimumFundingPercent?: number;
}): UtilisationFeeThresholdTotals {
  const minimumPercent = input.minimumFundingPercent ?? NOTE_DEFAULT_MINIMUM_FUNDING_PERCENT;
  const facilityFeeCollectAmount = resolvedFacilityFeeCollectAmount(
    input.schedule.facilityFeeCollectAmount
  );
  const shared = {
    platformFeeRatePercent: input.platformFeeRatePercent,
    facilityFeeCollectAmount,
    additionalFees: input.schedule.additionalFees,
    facilityFeeCollectionWaived: input.facilityFeeCollectionWaived,
  };
  const overflow = offerFeesExceedFundingThresholds({
    offeredAmount: input.offeredAmount,
    platformFeeRatePercent: input.platformFeeRatePercent,
    facilityFeeCollectAmount,
    additionalFees: input.schedule.additionalFees,
    minimumFundingPercent: minimumPercent,
  });
  // Display the entered/frozen collect exactly like send/close overflow.
  // Remaining is validated separately and must not silently cap these totals.
  return {
    full: computeScheduleFeesAtFundedAmount({
      ...shared,
      fundedAmount: input.offeredAmount,
      facilityFeeRemaining: Number.POSITIVE_INFINITY,
    }),
    minimum: computeScheduleFeesAtFundedAmount({
      ...shared,
      fundedAmount: roundNoteMoney(input.offeredAmount * (minimumPercent / 100)),
      facilityFeeRemaining: Number.POSITIVE_INFINITY,
    }),
    minimumPercent,
    exceedsAtFull: overflow.exceedsAtFull,
    exceedsAtMinimum: overflow.exceedsAtMinimum,
  };
}

export function utilisationFeeScheduleIssues(input: {
  schedule: UtilisationFeeScheduleState;
  facilityFeeRemaining?: number;
  collectEnabled?: boolean;
}): UtilisationFeeIssue[] {
  const issues: UtilisationFeeIssue[] = [];
  if (
    facilityFeeCollectNeedsExplicitAmount({
      collectAmount: input.schedule.facilityFeeCollectAmount,
      collectEnabled: input.collectEnabled,
      facilityFeeRemaining: input.facilityFeeRemaining,
    })
  ) {
    issues.push({
      path: "facilityFeeCollectAmount",
      message: FACILITY_FEE_COLLECT_REQUIRED_MESSAGE,
    });
  }
  const collect = validateFacilityFeeCollectAmount(
    resolvedFacilityFeeCollectAmount(input.schedule.facilityFeeCollectAmount)
  );
  issues.push(...collect.issues);
  if (input.collectEnabled === false && collect.amount > 0) {
    issues.push({
      path: "facilityFeeCollectAmount",
      message: "Facility fee collection can only be set on a facility-linked invoice",
    });
  }
  if (
    input.facilityFeeRemaining != null &&
    collect.amount - input.facilityFeeRemaining > 1e-9
  ) {
    issues.push({
      path: "facilityFeeCollectAmount",
      message: facilityFeeCollectExceedsAvailableMessage(input.facilityFeeRemaining),
    });
  }
  if (input.schedule.additionalFees.length > FEE_SCHEDULE_MAX_ADDITIONAL_LINES) {
    issues.push({
      path: "additionalFees",
      message: `At most ${FEE_SCHEDULE_MAX_ADDITIONAL_LINES} additional fee lines are allowed`,
    });
  }
  issues.push(...validateAdditionalFeeLines(input.schedule.additionalFees).issues);
  return issues;
}

export function utilisationFeeSendBlockedReason(input: {
  offeredAmount: number;
  platformFeeRatePercent: number;
  schedule: UtilisationFeeScheduleState;
  facilityFeeRemaining?: number;
  collectEnabled?: boolean;
  facilityFeeCollectionWaived?: boolean;
}): string | null {
  const issues = utilisationFeeScheduleIssues({
    schedule: input.schedule,
    facilityFeeRemaining: input.facilityFeeRemaining,
    collectEnabled: input.collectEnabled,
  });
  if (issues.length > 0) return issues[0]?.message ?? "Fee schedule is invalid";
  const totals = summariseUtilisationFees({
    offeredAmount: input.offeredAmount,
    platformFeeRatePercent: input.platformFeeRatePercent,
    schedule: input.schedule,
    facilityFeeRemaining: input.facilityFeeRemaining,
    facilityFeeCollectionWaived: input.facilityFeeCollectionWaived,
  });
  if (totals.exceedsAtFull) {
    return "Fees cannot exceed the offered amount at full funding";
  }
  if (totals.exceedsAtMinimum) {
    return `Fees exceed the note amount at the ${totals.minimumPercent}% minimum funding threshold`;
  }
  return null;
}

/** Frozen confirm payload plus live per-invoice remaining used at Confirm & Send. */
export type InvoiceOfferConfirmFeeSnapshot = {
  offeredAmount: number;
  platformFeeRatePercent: number;
  feeScheduleMode: InvoiceOfferFeeScheduleWriteMode;
  facilityFeeCollectAmount: number;
  additionalFees: AdditionalFeeLine[];
  offerFingerprint: string;
};

export function invoiceOfferConfirmFeeBlockedReason(input: {
  offeredAmount: number;
  platformFeeRatePercent: number;
  feeScheduleMode: InvoiceOfferFeeScheduleWriteMode;
  facilityFeeCollectAmount: number;
  additionalFees: AdditionalFeeLine[];
  facilityFeeRemaining?: number;
  collectEnabled: boolean;
}): string | null {
  const grandfather = input.feeScheduleMode === "preserve_grandfather";
  return utilisationFeeSendBlockedReason({
    offeredAmount: input.offeredAmount,
    platformFeeRatePercent: input.platformFeeRatePercent,
    schedule: grandfather
      ? emptyUtilisationFeeSchedule()
      : {
          facilityFeeCollectAmount: input.facilityFeeCollectAmount,
          additionalFees: input.additionalFees,
        },
    facilityFeeRemaining: grandfather ? undefined : input.facilityFeeRemaining,
    collectEnabled: grandfather ? false : input.collectEnabled,
  });
}

export type InvoiceOfferConfirmGuard = {
  facilityFeeRemaining: number | undefined;
  collectEnabled: boolean;
  feeBlockedReason: string | null;
  fingerprintStale: boolean;
  invoiceMissing: boolean;
};

export type InvoiceOfferConfirmRefreshStatus = "idle" | "pending" | "ready" | "failed";

export type InvoiceOfferConfirmLiveFacilityFee = {
  remaining: number | undefined;
  collectEnabled: boolean;
};

/** Missing application id cannot refresh live remaining — treat as failed, not ready. */
export function resolveInvoiceOfferConfirmRefreshStart(
  applicationId?: string | null
): InvoiceOfferConfirmRefreshStatus {
  return applicationId ? "pending" : "failed";
}

export function invoiceOfferConfirmUiBlocked(input: {
  refreshStatus: InvoiceOfferConfirmRefreshStatus;
  guard: InvoiceOfferConfirmGuard | null;
}): boolean {
  if (input.refreshStatus !== "ready") return true;
  if (input.guard == null) return true;
  return invoiceOfferConfirmSubmitBlocked(input.guard);
}

export function resolveInvoiceOfferConfirmUiMessage(input: {
  refreshStatus: InvoiceOfferConfirmRefreshStatus;
  guard: InvoiceOfferConfirmGuard | null;
}): string | null {
  if (input.refreshStatus === "pending") return INVOICE_OFFER_CONFIRM_REFRESHING_MESSAGE;
  if (input.refreshStatus === "failed") return INVOICE_OFFER_CONFIRM_REFRESH_FAILED_MESSAGE;
  return input.guard?.feeBlockedReason ?? null;
}

/** Live remaining + fingerprint vs the frozen snapshot that Confirm & Send would post. */
export function resolveInvoiceOfferConfirmGuard(input: {
  confirm: InvoiceOfferConfirmFeeSnapshot;
  invoice?: {
    offer_details?: unknown;
    facilityFeeAvailableToReserve?: number | null;
  };
}): InvoiceOfferConfirmGuard {
  const invoiceMissing = input.invoice == null;
  const facilityFeeRemaining = input.invoice
    ? resolveInvoiceOfferFacilityFeeRemaining(input.invoice)
    : undefined;
  const collectEnabled = input.invoice
    ? invoiceOfferFacilityFeeCollectEnabled(input.invoice)
    : false;
  const fingerprintStale =
    input.invoice != null &&
    invoiceOfferFeeFingerprint(input.invoice.offer_details) !== input.confirm.offerFingerprint;
  return {
    facilityFeeRemaining,
    collectEnabled,
    fingerprintStale,
    invoiceMissing,
    feeBlockedReason: invoiceMissing
      ? INVOICE_OFFER_CONFIRM_INVOICE_MISSING_MESSAGE
      : invoiceOfferConfirmFeeBlockedReason({
          offeredAmount: input.confirm.offeredAmount,
          platformFeeRatePercent: input.confirm.platformFeeRatePercent,
          feeScheduleMode: input.confirm.feeScheduleMode,
          facilityFeeCollectAmount: input.confirm.facilityFeeCollectAmount,
          additionalFees: input.confirm.additionalFees,
          facilityFeeRemaining,
          collectEnabled,
        }),
  };
}

export function invoiceOfferConfirmSubmitBlocked(guard: InvoiceOfferConfirmGuard): boolean {
  return guard.invoiceMissing || guard.fingerprintStale || Boolean(guard.feeBlockedReason);
}
