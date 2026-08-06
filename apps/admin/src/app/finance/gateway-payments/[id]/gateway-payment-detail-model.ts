import type { GatewayPaymentDetailDto } from "@cashsouk/types";

export function readAmountMismatch(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null;
  const raw =
    (metadata.amountMismatch as Record<string, unknown> | undefined) ??
    (metadata.captureMismatch as Record<string, unknown> | undefined);
  if (!raw) return null;
  if (raw.mismatchType === "CURRENCY_MISMATCH") return null;
  const expectedSen = raw.expectedSen;
  const actualSen = raw.actualSen;
  if (typeof expectedSen !== "number" || typeof actualSen !== "number") return null;
  if (expectedSen === actualSen) return null;
  return {
    expectedSen,
    actualSen,
    curlecPaymentId: typeof raw.curlecPaymentId === "string" ? raw.curlecPaymentId : null,
  };
}

export function readCurrencyMismatch(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null;
  const raw = metadata.captureMismatch as Record<string, unknown> | undefined;
  if (!raw || raw.mismatchType !== "CURRENCY_MISMATCH") return null;
  return {
    expectedCurrency:
      typeof raw.expectedCurrency === "string" ? raw.expectedCurrency : null,
    actualCurrency: typeof raw.actualCurrency === "string" ? raw.actualCurrency : null,
    reason: typeof raw.reason === "string" ? raw.reason : null,
  };
}

export function readWalletReversalFailure(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null;
  const raw = metadata.refundConfirmedWalletReversalFailed as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return null;
  return {
    refundId: typeof raw.refundId === "string" ? raw.refundId : null,
    intendedReversalAmount:
      typeof raw.intendedReversalAmount === "number" ? raw.intendedReversalAmount : null,
    blockedAmount: typeof raw.blockedAmount === "number" ? raw.blockedAmount : null,
    fundsProtected: typeof raw.fundsProtected === "boolean" ? raw.fundsProtected : null,
    fundsBlocked: typeof raw.fundsBlocked === "boolean" ? raw.fundsBlocked : null,
    originalWalletCreditKey:
      typeof raw.originalWalletCreditKey === "string"
        ? raw.originalWalletCreditKey
        : typeof raw.originalWalletCreditId === "string"
          ? raw.originalWalletCreditId
          : null,
    lastAttemptAt: typeof raw.lastAttemptAt === "string" ? raw.lastAttemptAt : null,
    failureCategory: typeof raw.failureCategory === "string" ? raw.failureCategory : null,
    error: typeof raw.error === "string" ? raw.error : null,
  };
}

export function readRefundRequestedAt(
  payment: {
    metadata: Record<string, unknown> | null;
    events?: Array<{ type: string; createdAt: string }>;
  } | null
) {
  if (!payment) return null;
  const attempt = payment.metadata?.refundAttempt as { requestedAt?: string } | undefined;
  if (typeof attempt?.requestedAt === "string") return attempt.requestedAt;
  const event = payment.events?.find((item) => item.type === "REFUND_INITIATED");
  return event?.createdAt ?? null;
}

/** Production visibility rules for Gateway Payment detail actions/cards. */
export function getGatewayPaymentDetailVisibility(payment: GatewayPaymentDetailDto) {
  const amountMismatch = readAmountMismatch(payment.metadata);
  const currencyMismatch = readCurrencyMismatch(payment.metadata);
  const walletReversalFailure = readWalletReversalFailure(payment.metadata);

  const showReviewNameCheck = payment.status === "NAME_CHECK_PENDING";
  const showMismatchRefundPending =
    Boolean(amountMismatch) && payment.status === "REFUND_INITIATED";
  const showMismatchRefunded = Boolean(amountMismatch) && payment.status === "REFUNDED";
  const showCurrencyMismatchCard =
    Boolean(currencyMismatch) && payment.status === "HELD";
  const showWalletReversalCard =
    Boolean(walletReversalFailure) && payment.status === "HELD";
  const showRetryRefund =
    payment.status === "HELD" && !showCurrencyMismatchCard && !showWalletReversalCard;
  const showInitiateRefund =
    payment.status === "COMPLETED" && payment.purpose === "INVESTOR_DEPOSIT";

  return {
    amountMismatch,
    currencyMismatch,
    walletReversalFailure,
    showReviewNameCheck,
    showMismatchRefundPending,
    showMismatchRefunded,
    showCurrencyMismatchCard,
    showWalletReversalCard,
    showRetryRefund,
    showInitiateRefund,
    showNameCheckCard: showReviewNameCheck,
    showHeldRefundCard: showRetryRefund,
  };
}
