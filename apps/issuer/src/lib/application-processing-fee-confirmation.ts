import type { GatewayPaymentStatus } from "@cashsouk/types";
import { buildApplicationEditReturnTo } from "@/lib/application-processing-fee-routes";

export const PROCESSING_FEE_CONFIRM_TIMEOUT_MS = 20_000;
export const PROCESSING_FEE_CONFIRM_POLL_MS = 1_000;
export const PROCESSING_FEE_DELAYED_POLL_MS = 3_000;
export const PROCESSING_FEE_SLOW_POLL_MS = 8_000;
export const PROCESSING_FEE_SLOW_POLL_AFTER_MS = 60_000;
export const PROCESSING_FEE_LEAVE_FOR_NOW_PATH = "/applications";

const TERMINAL_FEE_STATUSES = new Set<GatewayPaymentStatus>([
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "REFUND_INITIATED",
]);

const RETRYABLE_UNPAID_STATUSES = new Set<GatewayPaymentStatus>([
  "FAILED",
  "EXPIRED",
  "REFUNDED",
]);

const IN_FLIGHT_STATUSES = new Set<GatewayPaymentStatus>([
  "CREATED",
  "PAID",
  "NAME_CHECK_PENDING",
]);

export function isTerminalProcessingFeeStatus(status: GatewayPaymentStatus): boolean {
  return TERMINAL_FEE_STATUSES.has(status);
}

export function isRetryableUnpaidProcessingFeeStatus(
  status: GatewayPaymentStatus | null | undefined
): boolean {
  return status != null && RETRYABLE_UNPAID_STATUSES.has(status);
}

export function isInFlightProcessingFeeStatus(
  status: GatewayPaymentStatus | null | undefined
): boolean {
  return status == null || IN_FLIGHT_STATUSES.has(status);
}

export function isProcessingFeeConfirmDelayed(elapsedMs: number): boolean {
  return elapsedMs >= PROCESSING_FEE_CONFIRM_TIMEOUT_MS;
}

export function shouldReconcileProcessingFeeDetail(
  status: GatewayPaymentStatus | null | undefined,
  pollWhileConfirming: boolean
): boolean {
  return pollWhileConfirming || status === "PAID" || status === "NAME_CHECK_PENDING";
}

export function shouldStopProcessingFeeConfirmPoll(
  status: GatewayPaymentStatus | null | undefined
): boolean {
  if (status === "HELD") return true;
  return Boolean(status && isTerminalProcessingFeeStatus(status));
}

export function processingFeeConfirmPollIntervalMs(input: {
  status?: GatewayPaymentStatus | null;
  pollUntilTerminal: boolean;
  elapsedMs: number;
}): number | false {
  if (!input.pollUntilTerminal) return false;
  if (shouldStopProcessingFeeConfirmPoll(input.status)) return false;
  if (input.elapsedMs >= PROCESSING_FEE_SLOW_POLL_AFTER_MS) {
    return PROCESSING_FEE_SLOW_POLL_MS;
  }
  if (isProcessingFeeConfirmDelayed(input.elapsedMs)) {
    return PROCESSING_FEE_DELAYED_POLL_MS;
  }
  return PROCESSING_FEE_CONFIRM_POLL_MS;
}

export const processingFeeConfirmQueryRefresh = {
  refetchOnWindowFocus: true,
  refetchIntervalInBackground: false,
  staleTime: 0,
  refetchOnMount: "always" as const,
};

export const PROCESSING_FEE_CONFIRMING_COPY = {
  title: "Confirming your payment",
  description: "We're checking with your bank. This usually takes a few seconds.",
} as const;

export const PROCESSING_FEE_DELAYED_COPY = {
  title: "Still confirming your payment",
  description:
    "Your bank hasn't confirmed this payment yet. Do not pay again — we are still checking. You can leave and come back later.",
} as const;

export type ProcessingFeeReturnPhase =
  | "confirming"
  | "delayed"
  | "submitting"
  | "submitted"
  | "under-review"
  | "failed";

export type ProcessingFeeReturnFailureReason = "failed" | "error";

export type ProcessingFeeReturnInternalPhase =
  | "confirming"
  | "submitting"
  | "submitted"
  | "failed";

export type ProcessingFeeReturnDialogView = {
  phase: ProcessingFeeReturnPhase;
  failureReason: ProcessingFeeReturnFailureReason;
  dialogTitle: string;
  title: string;
  description: string;
  shouldPoll: boolean;
  shouldAutoSubmit: boolean;
  showPayRetry: boolean;
  showLeaveForNow: boolean;
  awaitingConfirmation: boolean;
};

const DIALOG_TITLE: Record<ProcessingFeeReturnPhase, string> = {
  confirming: PROCESSING_FEE_CONFIRMING_COPY.title,
  delayed: PROCESSING_FEE_DELAYED_COPY.title,
  submitting: "Submitting your application",
  submitted: "Application submitted",
  "under-review": "Payment under review",
  failed: "Payment not completed",
};

export function deriveProcessingFeeReturnDialogView(input: {
  status?: GatewayPaymentStatus | null;
  elapsedMs: number;
  isQueryError?: boolean;
  internalPhase?: ProcessingFeeReturnInternalPhase;
  submitFailed?: boolean;
}): ProcessingFeeReturnDialogView {
  const internalPhase = input.internalPhase ?? "confirming";

  if (internalPhase === "submitting") {
    return view("submitting", {
      title: "Submitting your application",
      description: "Your payment was received. We're submitting your application for review.",
    });
  }

  if (internalPhase === "submitted") {
    return view("submitted", {
      title: "Application submitted",
      description: "Your application has been sent for review.",
    });
  }

  if (internalPhase === "failed" || input.submitFailed) {
    return view("failed", {
      title: "Could not submit application",
      description:
        "Your payment was received, but we could not submit the application. Please try again or contact support if this continues.",
      failureReason: "error",
    });
  }

  const status = input.status ?? null;

  if (status === "HELD") {
    return view("under-review", {
      title: "Payment under review",
      description: "You do not need to make another payment while this fee is under review.",
    });
  }

  if (status === "COMPLETED") {
    return view("confirming", {
      title: PROCESSING_FEE_CONFIRMING_COPY.title,
      description: PROCESSING_FEE_CONFIRMING_COPY.description,
      shouldAutoSubmit: true,
    });
  }

  if (isRetryableUnpaidProcessingFeeStatus(status)) {
    return view("failed", {
      title: status === "EXPIRED" ? "Payment expired" : "Payment not completed",
      description:
        status === "EXPIRED"
          ? "This payment session has expired. Please start a new payment to continue."
          : "Your FPX payment wasn't completed. No fee has been charged — you can try again when ready.",
      showPayRetry: true,
    });
  }

  if (status === "REFUND_INITIATED") {
    return view("failed", {
      title: "Payment cannot be retried yet",
      description:
        "A previous payment is still being reversed. Do not pay again. Please wait or contact support.",
      showLeaveForNow: true,
    });
  }

  const delayed = isProcessingFeeConfirmDelayed(input.elapsedMs);
  const copy = delayed ? PROCESSING_FEE_DELAYED_COPY : PROCESSING_FEE_CONFIRMING_COPY;

  return view(delayed ? "delayed" : "confirming", {
    title: copy.title,
    description: copy.description,
    shouldPoll: true,
    showLeaveForNow: delayed,
    awaitingConfirmation: true,
    // Transient query errors stay on the confirming/delayed path; never a pay CTA.
    failureReason: input.isQueryError ? "error" : "failed",
  });
}

function view(
  phase: ProcessingFeeReturnPhase,
  overrides: Partial<ProcessingFeeReturnDialogView> & {
    title: string;
    description: string;
  }
): ProcessingFeeReturnDialogView {
  return {
    phase,
    failureReason: "failed",
    dialogTitle: DIALOG_TITLE[phase],
    shouldPoll: false,
    shouldAutoSubmit: false,
    showPayRetry: false,
    showLeaveForNow: false,
    awaitingConfirmation: phase === "confirming" || phase === "delayed",
    ...overrides,
  };
}

export type ProcessingFeePayStepState = "ready-to-pay" | "confirming" | "held" | "paid";

export type ProcessingFeePayStepModel = {
  state: ProcessingFeePayStepState;
  showPayCta: boolean;
  showUnderReview: boolean;
  pollWhileConfirming: boolean;
  headline: string;
  description: string;
  ctaLabel: string | null;
};

export function deriveProcessingFeePayStepModel(input: {
  status?: GatewayPaymentStatus | null;
  heldError?: boolean;
  awaitingConfirmation?: boolean;
}): ProcessingFeePayStepModel {
  const status = input.status ?? null;

  if (input.heldError || status === "HELD" || status === "REFUND_INITIATED") {
    return {
      state: "held",
      showPayCta: false,
      showUnderReview: true,
      pollWhileConfirming: status === "HELD",
      headline: "Processing fee",
      description: "Your payment is being verified before the application can be submitted.",
      ctaLabel: null,
    };
  }

  if (status === "COMPLETED") {
    return {
      state: "paid",
      showPayCta: false,
      showUnderReview: false,
      pollWhileConfirming: false,
      headline: "Processing fee",
      description: "Your processing fee has been received.",
      ctaLabel: null,
    };
  }

  const confirming =
    status === "PAID" ||
    Boolean(input.awaitingConfirmation && isInFlightProcessingFeeStatus(status));

  if (confirming) {
    return {
      state: "confirming",
      showPayCta: false,
      showUnderReview: false,
      pollWhileConfirming: true,
      headline: "Processing fee",
      description: PROCESSING_FEE_DELAYED_COPY.description,
      ctaLabel: null,
    };
  }

  return {
    state: "ready-to-pay",
    showPayCta: true,
    showUnderReview: false,
    pollWhileConfirming: false,
    headline: "Pay processing fee",
    description:
      "Your declarations have been saved. Complete this one-time fee to submit your application for review.",
    ctaLabel: "Pay with FPX",
  };
}

/** Idempotent create/load is safe; skip it only while a specific fee is being confirmed. */
export function shouldLoadProcessingFeeOrder(
  resumeFeeId: string | null | undefined
): boolean {
  return !resumeFeeId;
}

export function resolveProcessingFeeCheckoutOrder<T>(input: {
  resumeFeeId?: string | null;
  savedFee?: T | null;
  liveOrder?: T | null;
}): T | null {
  if (input.resumeFeeId) return input.savedFee ?? null;
  return input.liveOrder ?? null;
}

export function isProcessingFeePayBlockedOnLiveOrder(input: {
  resumeFeeId?: string | null;
  liveOrder?: unknown;
}): boolean {
  return !input.resumeFeeId && input.liveOrder == null;
}

export function isProcessingFeeAmountLoading(input: {
  resumeFeeId?: string | null;
  liveOrder?: unknown;
  isOrderLoading: boolean;
  payState: ProcessingFeePayStepState;
}): boolean {
  if (input.payState !== "ready-to-pay") return false;
  if (input.resumeFeeId) return false;
  return input.liveOrder == null && input.isOrderLoading;
}

export type ProcessingFeeReturnCloseAction = "retry-payment" | "leave-for-now";

export function resolveProcessingFeeReturnDestination(input: {
  action: ProcessingFeeReturnCloseAction;
  applicationId: string;
  pendingReturnTo?: string | null;
}): string {
  if (input.action === "leave-for-now") {
    return PROCESSING_FEE_LEAVE_FOR_NOW_PATH;
  }
  return input.pendingReturnTo ?? buildApplicationEditReturnTo(input.applicationId);
}

export type ProcessingFeeReturnPinState = {
  pinnedFeeId: string | null;
  pinnedApplicationId: string | null;
  dismissed: boolean;
};

export function dismissProcessingFeeReturnPinState(
  current: ProcessingFeeReturnPinState
): ProcessingFeeReturnPinState {
  return { ...current, dismissed: true };
}

export function nextProcessingFeeReturnPinState(
  current: ProcessingFeeReturnPinState,
  urlFeeId: string | null,
  urlApplicationId: string | null,
  pendingResumeFeeId: string | null = null
): ProcessingFeeReturnPinState {
  if (urlFeeId && urlFeeId !== current.pinnedFeeId) {
    return {
      pinnedFeeId: urlFeeId,
      pinnedApplicationId: urlApplicationId ?? current.pinnedApplicationId,
      dismissed: false,
    };
  }
  if (current.dismissed) return current;
  if (
    !urlFeeId &&
    pendingResumeFeeId &&
    pendingResumeFeeId !== current.pinnedFeeId
  ) {
    return {
      pinnedFeeId: pendingResumeFeeId,
      pinnedApplicationId: urlApplicationId ?? current.pinnedApplicationId,
      dismissed: false,
    };
  }
  if (urlApplicationId && urlApplicationId !== current.pinnedApplicationId) {
    return { ...current, pinnedApplicationId: urlApplicationId };
  }
  return current;
}

export function resolveProcessingFeeReturnIds(state: ProcessingFeeReturnPinState): {
  feeId: string | null;
  applicationId: string | null;
} {
  if (state.dismissed) return { feeId: null, applicationId: null };
  return { feeId: state.pinnedFeeId, applicationId: state.pinnedApplicationId };
}

export type ProcessingFeePendingConfirmation = {
  applicationId: string;
  returnTo: string;
  declarationsSaved?: boolean;
  feeId?: string;
  awaitingConfirmation?: boolean;
};

type StoredProcessingFeePendingConfirmation = ProcessingFeePendingConfirmation & {
  storedAt: number;
};

export type ProcessingFeePendingStore = {
  version: 1;
  entries: Record<string, StoredProcessingFeePendingConfirmation>;
};

function isProcessingFeePendingConfirmation(
  value: unknown
): value is ProcessingFeePendingConfirmation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.applicationId === "string" && typeof record.returnTo === "string";
}

export function parseProcessingFeePendingStore(raw: string | null): ProcessingFeePendingStore {
  const empty: ProcessingFeePendingStore = { version: 1, entries: {} };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isProcessingFeePendingConfirmation(parsed)) {
      return {
        version: 1,
        entries: { [parsed.applicationId]: { ...parsed, storedAt: 0 } },
      };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return empty;
    const record = parsed as Record<string, unknown>;
    if (
      record.version !== 1 ||
      !record.entries ||
      typeof record.entries !== "object" ||
      Array.isArray(record.entries)
    ) {
      return empty;
    }
    const entries = Object.fromEntries(
      Object.values(record.entries as Record<string, unknown>)
        .filter(isProcessingFeePendingConfirmation)
        .map((value) => [
          value.applicationId,
          {
            ...value,
            storedAt: Number((value as Record<string, unknown>).storedAt) || 0,
          },
        ])
    );
    return { version: 1, entries };
  } catch {
    return empty;
  }
}

export function upsertProcessingFeePendingStore(
  store: ProcessingFeePendingStore,
  pending: ProcessingFeePendingConfirmation,
  storedAt = Date.now()
): ProcessingFeePendingStore {
  const latestStoredAt = Object.values(store.entries).reduce(
    (latest, entry) => Math.max(latest, entry.storedAt),
    0
  );
  return {
    version: 1,
    entries: {
      ...store.entries,
      [pending.applicationId]: {
        ...pending,
        storedAt: Math.max(storedAt, latestStoredAt + 1),
      },
    },
  };
}

export function removeProcessingFeePendingStoreEntry(
  store: ProcessingFeePendingStore,
  applicationId: string
): ProcessingFeePendingStore {
  const entries = { ...store.entries };
  delete entries[applicationId];
  return { version: 1, entries };
}

export function readProcessingFeePendingStoreEntry(
  store: ProcessingFeePendingStore,
  applicationId?: string
): ProcessingFeePendingConfirmation | null {
  if (applicationId) return store.entries[applicationId] ?? null;
  return (
    Object.values(store.entries).reduce<StoredProcessingFeePendingConfirmation | null>(
      (latest, entry) => (!latest || entry.storedAt > latest.storedAt ? entry : latest),
      null
    ) ?? null
  );
}

export function processingFeePendingForApplication(
  pending: ProcessingFeePendingConfirmation | null | undefined,
  applicationId: string
): ProcessingFeePendingConfirmation | null {
  return pending?.applicationId === applicationId ? pending : null;
}

export function markProcessingFeeAwaitingConfirmation(
  pending: ProcessingFeePendingConfirmation,
  feeId: string
): ProcessingFeePendingConfirmation {
  return {
    ...pending,
    feeId,
    awaitingConfirmation: true,
  };
}

export function clearProcessingFeeAwaitingConfirmation(
  pending: ProcessingFeePendingConfirmation
): ProcessingFeePendingConfirmation {
  return {
    ...pending,
    awaitingConfirmation: false,
  };
}

/** Clear a checkout that was marked in-flight but abandoned (modal dismiss or thrown open). */
export function releaseAbandonedProcessingFeeCheckout(
  pending: ProcessingFeePendingConfirmation | null | undefined,
  applicationId: string,
  markedFeeId: string | null
): ProcessingFeePendingConfirmation | null {
  if (
    !pending ||
    !markedFeeId ||
    pending.applicationId !== applicationId ||
    pending.feeId !== markedFeeId
  ) {
    return pending ?? null;
  }
  return clearProcessingFeeAwaitingConfirmation(pending);
}

export function isProcessingFeeAwaitingConfirmation(
  pending: ProcessingFeePendingConfirmation | null | undefined,
  applicationId: string
): boolean {
  return (
    pending?.applicationId === applicationId && pending.awaitingConfirmation === true
  );
}

export function resolvePendingProcessingFeeResumeFeeId(
  pending: ProcessingFeePendingConfirmation | null | undefined,
  applicationId: string | null
): string | null {
  if (!applicationId) return null;
  if (!isProcessingFeeAwaitingConfirmation(pending, applicationId)) return null;
  return pending?.feeId ?? null;
}
