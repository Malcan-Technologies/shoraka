import type { GatewayPaymentStatus } from "@cashsouk/types";

export const EXCESS_LATE_CHARGE_HELD_ERROR_CODE = "EXCESS_LATE_CHARGE_CAPTURE_MISMATCH_HELD";

const TERMINAL_STATUSES = new Set<GatewayPaymentStatus>([
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "REFUND_INITIATED",
]);

export function isTerminalExcessLateChargeStatus(status: GatewayPaymentStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function excessLateChargePollIntervalMs(
  status: GatewayPaymentStatus | undefined,
  pollUntilTerminal: boolean
): number | false {
  if (!pollUntilTerminal) return false;
  if (status === "HELD") return false;
  if (status && isTerminalExcessLateChargeStatus(status)) return false;
  return 1_000;
}

export type ExcessLateChargePaymentCardState = "none" | "due" | "partial" | "complete" | "held";

export type ExcessLateChargePaymentCardModel = {
  state: ExcessLateChargePaymentCardState;
  owedAmount: number;
  creditedAmount: number;
  outstanding: number;
  progressPercent: number;
  requiresMultiplePayments: boolean;
  ctaLabel: string | null;
  title: string;
  description: string;
};

export function deriveExcessLateChargePaymentCardModel(input: {
  owedAmount: number;
  paidAmount: number;
  outstanding: number;
  noteReference: string;
  perTxnMaxAmount?: number | null;
  paymentStatus?: GatewayPaymentStatus | null;
  held?: boolean;
}): ExcessLateChargePaymentCardModel {
  const owedAmount = Math.max(0, input.owedAmount);
  const outstanding = Math.max(0, input.outstanding);
  const creditedAmount = Math.max(0, Math.min(owedAmount, owedAmount - outstanding));
  const progressPercent =
    owedAmount <= 0 ? 100 : Math.min(100, Math.round((creditedAmount / owedAmount) * 100));
  const requiresMultiplePayments =
    outstanding > 0 &&
    input.perTxnMaxAmount != null &&
    Number.isFinite(input.perTxnMaxAmount) &&
    input.perTxnMaxAmount > 0 &&
    outstanding > input.perTxnMaxAmount;
  const title = "Pay outstanding late charges";
  const description = `RM ${outstanding.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} in late payment charges is due on note ${input.noteReference}.`;

  if (input.held || input.paymentStatus === "HELD") {
    return {
      state: "held",
      owedAmount,
      creditedAmount,
      outstanding,
      progressPercent,
      requiresMultiplePayments,
      ctaLabel: null,
      title,
      description,
    };
  }

  if (owedAmount <= 0) {
    return {
      state: "none",
      owedAmount,
      creditedAmount: 0,
      outstanding: 0,
      progressPercent: 100,
      requiresMultiplePayments: false,
      ctaLabel: null,
      title,
      description,
    };
  }

  if (outstanding <= 0) {
    return {
      state: "complete",
      owedAmount,
      creditedAmount: owedAmount,
      outstanding: 0,
      progressPercent: 100,
      requiresMultiplePayments: false,
      ctaLabel: null,
      title,
      description,
    };
  }

  const partial = creditedAmount > 0;
  return {
    state: partial ? "partial" : "due",
    owedAmount,
    creditedAmount,
    outstanding,
    progressPercent,
    requiresMultiplePayments,
    ctaLabel: partial ? "Make next FPX payment" : "Pay with FPX",
    title,
    description,
  };
}

export function mapExcessLateChargeOwnershipError(error: unknown): string {
  const code = readErrorCode(error);
  if (code === "NOTE_FORBIDDEN") {
    return "This note is not available or you do not have access.";
  }
  if (code === "EXCESS_LATE_CHARGE_NOT_FOUND") {
    return "Late charge payment not found.";
  }
  if (code === "EXCESS_LATE_CHARGE_NOT_DUE") {
    return "No outstanding late charges are due.";
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

export type ExcessLateChargeReturnPinState = {
  pinnedPaymentId: string | null;
  dismissed: boolean;
};

export function nextExcessLateChargeReturnPinState(
  current: ExcessLateChargeReturnPinState,
  urlPaymentId: string | null
): ExcessLateChargeReturnPinState {
  if (!urlPaymentId || urlPaymentId === current.pinnedPaymentId) {
    return current;
  }
  return { pinnedPaymentId: urlPaymentId, dismissed: false };
}

export function resolveExcessLateChargeReturnPaymentId(
  state: ExcessLateChargeReturnPinState
): string | null {
  return state.dismissed ? null : state.pinnedPaymentId;
}

export type ExcessLateChargeReturnDialogPhase =
  | "confirming"
  | "paid"
  | "partial"
  | "under-review"
  | "failed";

export type ExcessLateChargeReturnFailureReason = "failed" | "error" | "timeout";

export type ExcessLateChargeReturnDialogView = {
  phase: ExcessLateChargeReturnDialogPhase;
  failureReason: ExcessLateChargeReturnFailureReason;
  thisPaymentAmount: number | null;
  totalPaid: number;
  creditedAmount: number;
  owedAmount: number;
  outstanding: number;
  progressPercent: number;
  showThisPaymentVsTotal: boolean;
  awaitingConfirmation: boolean;
};

export function deriveExcessLateChargeReturnDialogView(input: {
  paymentAmount?: number | null;
  paymentStatus?: GatewayPaymentStatus | null;
  owedAmount: number;
  paidAmount: number;
  outstanding: number;
  noteReference: string;
  perTxnMaxAmount?: number | null;
  isQueryError?: boolean;
  pollTimedOut?: boolean;
}): ExcessLateChargeReturnDialogView {
  const totals = deriveExcessLateChargePaymentCardModel({
    owedAmount: input.owedAmount,
    paidAmount: input.paidAmount,
    outstanding: input.outstanding,
    noteReference: input.noteReference,
    perTxnMaxAmount: input.perTxnMaxAmount,
    paymentStatus: input.paymentStatus,
  });
  const hasDefinitiveSuccess = input.paymentStatus === "COMPLETED";
  const isUnderReview = input.paymentStatus === "HELD";
  const hasDefinitiveFailure =
    input.paymentStatus != null &&
    isTerminalExcessLateChargeStatus(input.paymentStatus) &&
    input.paymentStatus !== "COMPLETED";

  const phase: ExcessLateChargeReturnDialogPhase = isUnderReview
    ? "under-review"
    : hasDefinitiveSuccess
      ? totals.outstanding > 0
        ? "partial"
        : "paid"
      : hasDefinitiveFailure || input.isQueryError || input.pollTimedOut
        ? "failed"
        : "confirming";

  const thisPaymentAmount = input.paymentAmount ?? null;
  const totalPaid = totals.creditedAmount;
  const showThisPaymentVsTotal =
    thisPaymentAmount != null && Math.abs(thisPaymentAmount - totalPaid) > 1e-9;
  const awaitingConfirmation = !isUnderReview && !hasDefinitiveSuccess && !hasDefinitiveFailure;

  const failureReason: ExcessLateChargeReturnFailureReason = hasDefinitiveFailure
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
    totalPaid,
    creditedAmount: totals.creditedAmount,
    owedAmount: totals.owedAmount,
    outstanding: totals.outstanding,
    progressPercent: totals.progressPercent,
    showThisPaymentVsTotal,
    awaitingConfirmation,
  };
}
