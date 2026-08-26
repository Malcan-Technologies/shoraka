import type { GatewayPaymentStatus } from "@cashsouk/types";

export const FACILITY_FEE_DRAWDOWN_BLOCKED_MESSAGE =
  "Pay the upfront facility fee to start drawdowns";

export const FACILITY_FEE_HELD_ERROR_CODE = "FACILITY_FEE_CAPTURE_MISMATCH_HELD";

const TERMINAL_FACILITY_FEE_STATUSES = new Set<GatewayPaymentStatus>([
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "REFUND_INITIATED",
]);

export function isTerminalFacilityFeeStatus(status: GatewayPaymentStatus): boolean {
  return TERMINAL_FACILITY_FEE_STATUSES.has(status);
}

export function facilityFeePollIntervalMs(
  status: GatewayPaymentStatus | undefined,
  pollUntilTerminal: boolean
): number | false {
  if (!pollUntilTerminal) return false;
  if (status === "HELD") return false;
  if (status && isTerminalFacilityFeeStatus(status)) return false;
  return 1_000;
}

export function readFacilityFeeUpfrontOutstanding(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

export function hasFacilityFeeUpfrontOutstanding(value: unknown): boolean {
  return readFacilityFeeUpfrontOutstanding(value) > 0;
}

export type FacilityFeePaymentCardState = "none" | "due" | "partial" | "complete" | "held";

export type FacilityFeePaymentCardModel = {
  state: FacilityFeePaymentCardState;
  upfrontAmount: number;
  creditedAmount: number;
  outstanding: number;
  progressPercent: number;
  requiresMultiplePayments: boolean;
  ctaLabel: string | null;
};

export function deriveFacilityFeePaymentCardModel(input: {
  upfrontAmount: number;
  paidAmount: number;
  outstanding: number;
  perTxnMaxAmount?: number | null;
  paymentStatus?: GatewayPaymentStatus | null;
  held?: boolean;
}): FacilityFeePaymentCardModel {
  const upfrontAmount = Math.max(0, input.upfrontAmount);
  const outstanding = Math.max(0, input.outstanding);
  const creditedAmount = Math.max(0, Math.min(upfrontAmount, upfrontAmount - outstanding));
  const progressPercent =
    upfrontAmount <= 0 ? 100 : Math.min(100, Math.round((creditedAmount / upfrontAmount) * 100));
  const requiresMultiplePayments =
    outstanding > 0 &&
    input.perTxnMaxAmount != null &&
    Number.isFinite(input.perTxnMaxAmount) &&
    input.perTxnMaxAmount > 0 &&
    outstanding > input.perTxnMaxAmount;

  if (input.held || input.paymentStatus === "HELD") {
    return {
      state: "held",
      upfrontAmount,
      creditedAmount,
      outstanding,
      progressPercent,
      requiresMultiplePayments,
      ctaLabel: null,
    };
  }

  if (upfrontAmount <= 0) {
    return {
      state: "none",
      upfrontAmount,
      creditedAmount: 0,
      outstanding: 0,
      progressPercent: 100,
      requiresMultiplePayments: false,
      ctaLabel: null,
    };
  }

  if (outstanding <= 0) {
    return {
      state: "complete",
      upfrontAmount,
      creditedAmount: upfrontAmount,
      outstanding: 0,
      progressPercent: 100,
      requiresMultiplePayments: false,
      ctaLabel: null,
    };
  }

  const partial = creditedAmount > 0;
  return {
    state: partial ? "partial" : "due",
    upfrontAmount,
    creditedAmount,
    outstanding,
    progressPercent,
    requiresMultiplePayments,
    ctaLabel: partial ? "Make next FPX payment" : "Pay with FPX",
  };
}

export function mapFacilityFeeOwnershipError(error: unknown): string {
  const code = readErrorCode(error);
  if (code === "CONTRACT_FORBIDDEN") {
    return "This facility is not available or you do not have access.";
  }
  if (code === "FACILITY_FEE_NOT_FOUND") {
    return "Facility fee payment not found.";
  }
  if (code === "FACILITY_FEE_UPFRONT_SETTLED") {
    return "No outstanding upfront facility fee is due.";
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Could not start payment";
}

export function readErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  return "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
}

export function facilityFeeContractHref(contractId: string): string {
  return `/financing/contracts/${contractId}`;
}

export type FacilityFeeReturnPinState = {
  pinnedPaymentId: string | null;
  dismissed: boolean;
};

export function nextFacilityFeeReturnPinState(
  current: FacilityFeeReturnPinState,
  urlPaymentId: string | null
): FacilityFeeReturnPinState {
  if (!urlPaymentId || urlPaymentId === current.pinnedPaymentId) {
    return current;
  }
  return { pinnedPaymentId: urlPaymentId, dismissed: false };
}

export function resolveFacilityFeeReturnPaymentId(state: FacilityFeeReturnPinState): string | null {
  return state.dismissed ? null : state.pinnedPaymentId;
}

export type FacilityFeeReturnDialogPhase =
  | "confirming"
  | "paid"
  | "partial"
  | "under-review"
  | "failed";

export type FacilityFeeReturnFailureReason = "failed" | "error" | "timeout";

export type FacilityFeeReturnDialogView = {
  phase: FacilityFeeReturnDialogPhase;
  failureReason: FacilityFeeReturnFailureReason;
  thisPaymentAmount: number | null;
  totalUpfrontPaid: number;
  creditedAmount: number;
  upfrontAmount: number;
  outstanding: number;
  progressPercent: number;
  showThisPaymentVsTotal: boolean;
  awaitingConfirmation: boolean;
};

export function deriveFacilityFeeReturnDialogView(input: {
  paymentAmount?: number | null;
  paymentStatus?: GatewayPaymentStatus | null;
  upfrontAmount: number;
  paidAmount: number;
  outstanding: number;
  perTxnMaxAmount?: number | null;
  isQueryError?: boolean;
  pollTimedOut?: boolean;
}): FacilityFeeReturnDialogView {
  const totals = deriveFacilityFeePaymentCardModel({
    upfrontAmount: input.upfrontAmount,
    paidAmount: input.paidAmount,
    outstanding: input.outstanding,
    perTxnMaxAmount: input.perTxnMaxAmount,
    paymentStatus: input.paymentStatus,
  });
  const hasDefinitiveSuccess = input.paymentStatus === "COMPLETED";
  const isUnderReview = input.paymentStatus === "HELD";
  const hasDefinitiveFailure =
    input.paymentStatus != null &&
    isTerminalFacilityFeeStatus(input.paymentStatus) &&
    input.paymentStatus !== "COMPLETED";

  const phase: FacilityFeeReturnDialogPhase = isUnderReview
    ? "under-review"
    : hasDefinitiveSuccess
      ? totals.outstanding > 0
        ? "partial"
        : "paid"
      : hasDefinitiveFailure || input.isQueryError || input.pollTimedOut
        ? "failed"
        : "confirming";

  const thisPaymentAmount = input.paymentAmount ?? null;
  const totalUpfrontPaid = totals.creditedAmount;
  const showThisPaymentVsTotal =
    thisPaymentAmount != null && Math.abs(thisPaymentAmount - totalUpfrontPaid) > 1e-9;
  const awaitingConfirmation = !isUnderReview && !hasDefinitiveSuccess && !hasDefinitiveFailure;

  const failureReason: FacilityFeeReturnFailureReason = hasDefinitiveFailure
    ? "failed"
    : input.isQueryError
      ? "error"
      : input.pollTimedOut
        ? "timeout"
        : "failed";

  return {
    phase,
    failureReason,
    thisPaymentAmount,
    totalUpfrontPaid,
    creditedAmount: totals.creditedAmount,
    upfrontAmount: totals.upfrontAmount,
    outstanding: totals.outstanding,
    progressPercent: totals.progressPercent,
    showThisPaymentVsTotal,
    awaitingConfirmation,
  };
}
