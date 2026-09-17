import type { GatewayPaymentStatus } from "@cashsouk/types";
import {
  PROCESSING_FEE_CONFIRM_POLL_MS,
  PROCESSING_FEE_CONFIRM_TIMEOUT_MS,
  PROCESSING_FEE_DELAYED_COPY,
  PROCESSING_FEE_DELAYED_POLL_MS,
  PROCESSING_FEE_LEAVE_FOR_NOW_PATH,
  PROCESSING_FEE_SLOW_POLL_AFTER_MS,
  PROCESSING_FEE_SLOW_POLL_MS,
  clearProcessingFeeAwaitingConfirmation,
  deriveProcessingFeePayStepModel,
  deriveProcessingFeeReturnDialogView,
  isInFlightProcessingFeeStatus,
  isProcessingFeeAwaitingConfirmation,
  isProcessingFeeConfirmDelayed,
  isRetryableUnpaidProcessingFeeStatus,
  isTerminalProcessingFeeStatus,
  markProcessingFeeAwaitingConfirmation,
  nextProcessingFeeReturnPinState,
  processingFeeConfirmPollIntervalMs,
  processingFeeConfirmQueryRefresh,
  resolvePendingProcessingFeeResumeFeeId,
  resolveProcessingFeeReturnDestination,
  resolveProcessingFeeReturnIds,
} from "./application-processing-fee-confirmation";

function confirmingView(
  overrides: Partial<Parameters<typeof deriveProcessingFeeReturnDialogView>[0]> = {}
) {
  return deriveProcessingFeeReturnDialogView({
    elapsedMs: 0,
    internalPhase: "confirming",
    ...overrides,
  });
}

describe("processing fee confirmation timeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("stays confirming and keeps polling before 20 seconds", () => {
    const started = Date.now();
    jest.advanceTimersByTime(PROCESSING_FEE_CONFIRM_TIMEOUT_MS - 1);
    const elapsedMs = Date.now() - started;
    const view = confirmingView({ status: "CREATED", elapsedMs });

    expect(isProcessingFeeConfirmDelayed(elapsedMs)).toBe(false);
    expect(view.phase).toBe("confirming");
    expect(view.showPayRetry).toBe(false);
    expect(view.showLeaveForNow).toBe(false);
    expect(view.shouldPoll).toBe(true);
    expect(
      processingFeeConfirmPollIntervalMs({
        status: "CREATED",
        pollUntilTerminal: true,
        elapsedMs,
      })
    ).toBe(PROCESSING_FEE_CONFIRM_POLL_MS);
  });

  it("switches to delayed, not failed, at 20 seconds for CREATED and PAID", () => {
    const started = Date.now();
    jest.advanceTimersByTime(PROCESSING_FEE_CONFIRM_TIMEOUT_MS);
    const elapsedMs = Date.now() - started;

    for (const status of ["CREATED", "PAID"] as const) {
      const view = confirmingView({ status, elapsedMs, isQueryError: false });
      expect(view.phase).toBe("delayed");
      expect(view.phase).not.toBe("failed");
      expect(view.showPayRetry).toBe(false);
      expect(view.showLeaveForNow).toBe(true);
      expect(view.description).toBe(PROCESSING_FEE_DELAYED_COPY.description);
      expect(view.description).toMatch(/do not pay again/i);
      expect(
        processingFeeConfirmPollIntervalMs({
          status,
          pollUntilTerminal: true,
          elapsedMs,
        })
      ).toBe(PROCESSING_FEE_DELAYED_POLL_MS);
    }
  });

  it("backs off polling after a minute while still confirming", () => {
    const started = Date.now();
    jest.advanceTimersByTime(PROCESSING_FEE_SLOW_POLL_AFTER_MS);
    expect(
      processingFeeConfirmPollIntervalMs({
        status: "PAID",
        pollUntilTerminal: true,
        elapsedMs: Date.now() - started,
      })
    ).toBe(PROCESSING_FEE_SLOW_POLL_MS);
  });
});

describe("processing fee return dialog states", () => {
  it("treats unknown status and transient query errors as still confirming", () => {
    const unknown = confirmingView({ status: undefined, isQueryError: true, elapsedMs: 1_000 });
    expect(unknown.phase).toBe("confirming");
    expect(unknown.showPayRetry).toBe(false);
    expect(unknown.shouldPoll).toBe(true);

    const delayedError = confirmingView({
      status: "CREATED",
      isQueryError: true,
      elapsedMs: PROCESSING_FEE_CONFIRM_TIMEOUT_MS,
    });
    expect(delayedError.phase).toBe("delayed");
    expect(delayedError.showPayRetry).toBe(false);
    expect(delayedError.showLeaveForNow).toBe(true);
  });

  it("never offers Pay / Try again while the order is CREATED or PAID", () => {
    for (const status of ["CREATED", "PAID"] as const) {
      const view = confirmingView({ status, elapsedMs: PROCESSING_FEE_CONFIRM_TIMEOUT_MS });
      expect(view.showPayRetry).toBe(false);
      expect(view.awaitingConfirmation).toBe(true);
      expect(isRetryableUnpaidProcessingFeeStatus(status)).toBe(false);
    }
  });

  it("keeps HELD under review without a payment CTA", () => {
    const view = confirmingView({ status: "HELD", elapsedMs: PROCESSING_FEE_CONFIRM_TIMEOUT_MS });
    expect(view.phase).toBe("under-review");
    expect(view.showPayRetry).toBe(false);
    expect(view.showLeaveForNow).toBe(false);
    expect(view.shouldPoll).toBe(false);
    expect(
      processingFeeConfirmPollIntervalMs({
        status: "HELD",
        pollUntilTerminal: true,
        elapsedMs: 30_000,
      })
    ).toBe(false);
  });

  it("auto-submits when the fee is COMPLETED", () => {
    const view = confirmingView({ status: "COMPLETED", elapsedMs: 5_000 });
    expect(view.shouldAutoSubmit).toBe(true);
    expect(view.showPayRetry).toBe(false);
    expect(view.shouldPoll).toBe(false);
  });

  it("uses the submitting and submitted internal phases after COMPLETED", () => {
    expect(
      deriveProcessingFeeReturnDialogView({
        status: "COMPLETED",
        elapsedMs: 5_000,
        internalPhase: "submitting",
      }).phase
    ).toBe("submitting");
    expect(
      deriveProcessingFeeReturnDialogView({
        status: "COMPLETED",
        elapsedMs: 5_000,
        internalPhase: "submitted",
      }).phase
    ).toBe("submitted");
  });

  it("allows retry only for genuine unpaid terminal states", () => {
    for (const status of ["FAILED", "EXPIRED", "REFUNDED"] as GatewayPaymentStatus[]) {
      const view = confirmingView({ status, elapsedMs: 5_000 });
      expect(view.phase).toBe("failed");
      expect(view.showPayRetry).toBe(true);
      expect(view.showLeaveForNow).toBe(false);
      expect(isRetryableUnpaidProcessingFeeStatus(status)).toBe(true);
    }

    const refunding = confirmingView({ status: "REFUND_INITIATED", elapsedMs: 5_000 });
    expect(refunding.phase).toBe("failed");
    expect(refunding.showPayRetry).toBe(false);
    expect(refunding.showLeaveForNow).toBe(true);
    expect(refunding.description).toMatch(/do not pay again/i);
  });

  it("does not offer another payment after submit-after-payment failure", () => {
    const view = deriveProcessingFeeReturnDialogView({
      status: "COMPLETED",
      elapsedMs: 5_000,
      internalPhase: "failed",
      submitFailed: true,
    });
    expect(view.phase).toBe("failed");
    expect(view.showPayRetry).toBe(false);
    expect(view.title).toMatch(/could not submit/i);
  });
});

describe("processing fee pay step and navigation safety", () => {
  it("hides Pay with FPX for in-flight returned orders and PAID", () => {
    expect(
      deriveProcessingFeePayStepModel({
        status: "CREATED",
        awaitingConfirmation: true,
      }).showPayCta
    ).toBe(false);
    expect(
      deriveProcessingFeePayStepModel({
        status: "PAID",
        awaitingConfirmation: false,
      })
    ).toMatchObject({ showPayCta: false, state: "confirming", ctaLabel: null });
    expect(
      deriveProcessingFeePayStepModel({
        status: "CREATED",
        awaitingConfirmation: false,
      })
    ).toMatchObject({ showPayCta: true, ctaLabel: "Pay with FPX" });
  });

  it("shows Pay with FPX only after a retryable unpaid failure", () => {
    expect(
      deriveProcessingFeePayStepModel({ status: "FAILED", awaitingConfirmation: false }).ctaLabel
    ).toBe("Pay with FPX");
    expect(
      deriveProcessingFeePayStepModel({ status: "REFUNDED" }).showPayCta
    ).toBe(true);
    expect(
      deriveProcessingFeePayStepModel({
        status: "NAME_CHECK_PENDING",
        awaitingConfirmation: true,
      }).showPayCta
    ).toBe(false);
    expect(
      deriveProcessingFeePayStepModel({ status: "HELD" }).showPayCta
    ).toBe(false);
    expect(
      deriveProcessingFeePayStepModel({ status: "COMPLETED" }).showPayCta
    ).toBe(false);
  });

  it("leaves for now without routing to a payment CTA, and keeps pending resume state", () => {
    const leaveTo = resolveProcessingFeeReturnDestination({
      action: "leave-for-now",
      applicationId: "app_1",
      pendingReturnTo: "/applications/app_1/edit?continue=processingFee",
    });
    expect(leaveTo).toBe(PROCESSING_FEE_LEAVE_FOR_NOW_PATH);
    expect(leaveTo).not.toMatch(/continue=processingFee/);
    expect(leaveTo).not.toMatch(/Pay/i);

    const retryTo = resolveProcessingFeeReturnDestination({
      action: "retry-payment",
      applicationId: "app_1",
      pendingReturnTo: "/applications/app_1/edit?continue=processingFee",
    });
    expect(retryTo).toBe("/applications/app_1/edit?continue=processingFee");

    const pending = markProcessingFeeAwaitingConfirmation(
      {
        applicationId: "app_1",
        returnTo: retryTo,
        declarationsSaved: true,
      },
      "fee_1"
    );
    expect(isProcessingFeeAwaitingConfirmation(pending, "app_1")).toBe(true);
    expect(pending.awaitingConfirmation).toBe(true);
    expect(clearProcessingFeeAwaitingConfirmation(pending).awaitingConfirmation).toBe(false);
  });

  it("pins the return ids until a safe dismiss, then drops them so the dialog cannot reopen", () => {
    const pinned = nextProcessingFeeReturnPinState(
      { pinnedFeeId: null, pinnedApplicationId: null, dismissed: false },
      "fee_1",
      "app_1"
    );
    expect(resolveProcessingFeeReturnIds(pinned)).toEqual({
      feeId: "fee_1",
      applicationId: "app_1",
    });

    const dismissed = { ...pinned, dismissed: true };
    expect(resolveProcessingFeeReturnIds(dismissed)).toEqual({
      feeId: null,
      applicationId: null,
    });
    expect(
      nextProcessingFeeReturnPinState(dismissed, "fee_1", "app_1")
    ).toEqual(dismissed);
    expect(
      nextProcessingFeeReturnPinState(dismissed, "fee_2", "app_1")
    ).toEqual({
      pinnedFeeId: "fee_2",
      pinnedApplicationId: "app_1",
      dismissed: false,
    });
  });

  it("resumes the same fee confirmation after leave-for-now without a return URL", () => {
    const pending = markProcessingFeeAwaitingConfirmation(
      {
        applicationId: "app_1",
        returnTo: "/applications/app_1/edit?continue=processingFee",
        declarationsSaved: true,
      },
      "fee_1"
    );

    expect(
      resolveProcessingFeeReturnDestination({
        action: "leave-for-now",
        applicationId: "app_1",
      })
    ).toBe(PROCESSING_FEE_LEAVE_FOR_NOW_PATH);
    expect(resolvePendingProcessingFeeResumeFeeId(pending, "app_1")).toBe("fee_1");
    expect(resolvePendingProcessingFeeResumeFeeId(pending, "app_2")).toBeNull();
    expect(
      resolvePendingProcessingFeeResumeFeeId(
        { ...pending, awaitingConfirmation: false },
        "app_1"
      )
    ).toBeNull();

    const returned = nextProcessingFeeReturnPinState(
      { pinnedFeeId: null, pinnedApplicationId: null, dismissed: false },
      null,
      "app_1",
      resolvePendingProcessingFeeResumeFeeId(pending, "app_1")
    );
    expect(resolveProcessingFeeReturnIds(returned)).toEqual({
      feeId: "fee_1",
      applicationId: "app_1",
    });

    const urlTakesPrecedence = nextProcessingFeeReturnPinState(
      { pinnedFeeId: null, pinnedApplicationId: null, dismissed: false },
      "fee_url",
      "app_1",
      "fee_1"
    );
    expect(resolveProcessingFeeReturnIds(urlTakesPrecedence).feeId).toBe("fee_url");
  });

  it("lets a genuine terminal failure exit confirmation to retry", () => {
    const pending = markProcessingFeeAwaitingConfirmation(
      {
        applicationId: "app_1",
        returnTo: "/applications/app_1/edit?continue=processingFee",
        declarationsSaved: true,
      },
      "fee_1"
    );
    const resumed = nextProcessingFeeReturnPinState(
      { pinnedFeeId: null, pinnedApplicationId: "app_1", dismissed: false },
      null,
      "app_1",
      pending.feeId ?? null
    );
    expect(resolveProcessingFeeReturnIds(resumed).feeId).toBe("fee_1");

    const failedView = deriveProcessingFeeReturnDialogView({
      status: "FAILED",
      elapsedMs: 5_000,
    });
    expect(failedView.phase).toBe("failed");
    expect(failedView.showPayRetry).toBe(true);
    expect(
      deriveProcessingFeePayStepModel({
        status: "FAILED",
        awaitingConfirmation: true,
      })
    ).toMatchObject({ state: "ready-to-pay", showPayCta: true, ctaLabel: "Pay with FPX" });

    const afterRetry = clearProcessingFeeAwaitingConfirmation(pending);
    const dismissed = { ...resumed, dismissed: true };
    expect(isProcessingFeeAwaitingConfirmation(afterRetry, "app_1")).toBe(false);
    expect(resolvePendingProcessingFeeResumeFeeId(afterRetry, "app_1")).toBeNull();
    expect(resolveProcessingFeeReturnIds(dismissed)).toEqual({
      feeId: null,
      applicationId: null,
    });
    expect(
      nextProcessingFeeReturnPinState(dismissed, null, "app_1", pending.feeId ?? null)
    ).toEqual(dismissed);
  });
});

describe("processing fee status helpers", () => {
  it("classifies in-flight vs terminal statuses and pauses pollers correctly", () => {
    expect(isInFlightProcessingFeeStatus("CREATED")).toBe(true);
    expect(isInFlightProcessingFeeStatus("PAID")).toBe(true);
    expect(isInFlightProcessingFeeStatus(undefined)).toBe(true);
    expect(isTerminalProcessingFeeStatus("COMPLETED")).toBe(true);
    expect(isTerminalProcessingFeeStatus("FAILED")).toBe(true);
    expect(isTerminalProcessingFeeStatus("HELD")).toBe(false);
    expect(
      processingFeeConfirmPollIntervalMs({
        status: undefined,
        pollUntilTerminal: true,
        elapsedMs: 0,
      })
    ).toBe(PROCESSING_FEE_CONFIRM_POLL_MS);
    expect(processingFeeConfirmQueryRefresh.refetchIntervalInBackground).toBe(false);
    expect(processingFeeConfirmQueryRefresh.refetchOnWindowFocus).toBe(true);
  });
});
