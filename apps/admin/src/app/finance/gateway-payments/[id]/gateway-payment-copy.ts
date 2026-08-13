/**
 * Admin-facing copy for Gateway Payment detail UI.
 */

const INSUFFICIENT_BALANCE_RE =
  /Insufficient available balance \(available ([\d.]+), required ([\d.]+)\)/i;

/** Turn known internal error text into plain Admin wording. */
export function formatGatewayPaymentFailureReason(
  error: string | null | undefined,
  failureCategory?: string | null
): string {
  const raw = (error ?? failureCategory ?? "").trim();
  if (!raw) return "—";

  const balanceMatch = raw.match(INSUFFICIENT_BALANCE_RE);
  if (balanceMatch) {
    const available = Number(balanceMatch[1]);
    const required = Number(balanceMatch[2]);
    if (Number.isFinite(available) && Number.isFinite(required)) {
      return `Only RM${available.toFixed(2)} was available, but RM${required.toFixed(2)} needed to be removed from the wallet.`;
    }
  }

  if (raw.toLowerCase().includes("timed out") || raw.toLowerCase().includes("timeout")) {
    return "The refund request could not be completed in time.";
  }

  if (raw === "AMOUNT_MISMATCH") {
    return "The amount received does not match the amount expected.";
  }

  if (raw === "INSUFFICIENT_INVESTOR_BALANCE") {
    return "There was not enough balance in the wallet to complete the update.";
  }

  // Avoid showing machine codes as the only explanation.
  if (/^[A-Z][A-Z0-9_]+$/.test(raw)) {
    return "The update could not be completed. Please review this payment.";
  }

  return raw;
}

export type AmountMismatchRefundState =
  | "pending"
  | "completed"
  | "failed"
  | "uncertain";

/**
 * Amount mismatch card description with the real expected / received / refund amounts.
 * Pass the same money formatter used by the detail page (sen → display string).
 */
export function formatAmountMismatchDescription(input: {
  expectedSen: number;
  receivedSen: number;
  refundSen?: number;
  state: AmountMismatchRefundState;
  formatSen: (sen: number) => string;
}): string {
  const amountReceived = input.formatSen(input.receivedSen);
  const expectedAmount = input.formatSen(input.expectedSen);
  const refundAmount = input.formatSen(input.refundSen ?? input.receivedSen);
  const lead = `${amountReceived} was received instead of ${expectedAmount}.`;

  switch (input.state) {
    case "pending":
      return `${lead} A full refund of ${refundAmount} has been requested and is waiting for Curlec’s confirmation.`;
    case "completed":
      return `${lead} A full refund of ${refundAmount} has been completed.`;
    case "uncertain":
      return `${lead} A full refund of ${refundAmount} was requested, but the result has not yet been confirmed.`;
    case "failed":
    default:
      return `${lead} A full refund of ${refundAmount} could not be completed and requires attention.`;
  }
}

export function hasUncertainAmountMismatchRefund(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  if (!metadata) return false;
  return Boolean(metadata.autoRefundFailed);
}

export const GATEWAY_PAYMENT_COPY = {
  metrics: {
    amountPaid: "Amount paid",
    currency: "Currency",
    method: "Method",
    bank: "Bank",
    created: "Created",
    updated: "Updated",
  },

  nameCheck: {
    title: "Next action — name check",
    description:
      "The bank name could not be matched automatically. Approve to complete the deposit, or reject to start a refund.",
    profileName: "Investor profile name",
    bankName: "Name from bank",
    approve: "Approve name check",
    reject: "Reject name check",
  },

  amountMismatch: {
    title: "Amount mismatch",
    expectedAmount: "Expected amount",
    amountReceived: "Amount received",
    refundAmount: "Refund amount",
    refundReference: "Refund reference",
    refundRequested: "Refund requested",
    refundPendingFor: "Refund pending for",
    refundDate: "Refund date",
    amountReceivedRefunded: "Amount received / refunded",
  },

  currencyMismatch: {
    title: "Currency mismatch",
    description:
      "The payment currency does not match the currency expected by Cashsouk. The payment was not accepted and requires review.",
    expectedCurrency: "Expected currency",
    paymentCurrency: "Payment currency",
  },

  walletNeedsAttention: {
    title: "Needs attention",
    description:
      "The refund was completed, but the wallet balance could not be fully updated.",
    descriptionPartial:
      "Part of the refunded amount is still available in the wallet and needs attention.",
    refundAmount: "Refund amount",
    amountUnavailable: "Amount currently unavailable",
    originalDepositReference: "Original deposit reference",
    refundReference: "Refund reference",
    lastUpdateAttempt: "Last update attempt",
    reason: "Reason",
    fundsSecuredYes: "Refunded amount secured: Yes",
    fundsSecuredNo: "Refunded amount secured: No — review required",
    retryButton: "Retry wallet update",
  },

  heldRefund: {
    titleMismatch: "Refund needs attention",
    titleDefault: "Next action — retry refund",
    descriptionDefault:
      "The refund could not be completed. You can retry the refund.",
    retryButton: "Retry refund",
  },

  initiateRefund: {
    title: "Refund",
    description:
      "Start a refund for this completed investor deposit when a correction is needed.",
    button: "Start refund",
    dialogTitle: "Start refund",
    dialogDescription:
      "This starts a refund for a completed investor deposit. Use only when a correction is needed after the deposit was credited.",
    dialogSubmit: "Start refund",
  },

  paymentDetails: {
    title: "Payment details",
    description: "Names used for checks and payment references.",
    profileName: "Investor profile name",
    bankName: "Name from bank",
    orderReference: "Order reference",
    paymentReference: "Payment reference",
    settlement: "Settlement",
    refundReference: "Refund reference",
    nameCheck: "Name check",
    nameCheckAt: "Name check at",
    refundedAt: "Refunded at",
    refundNotes: "Refund notes",
  },

  receipt: {
    title: "Receipt",
    description: "Names printed on the official receipt.",
    notCreated: "Not created",
    noneYetTitle: "No receipt yet",
    noneYetDescription: "A receipt is created after this payment is completed.",
    receiptNumber: "Receipt number",
    receiptName: "Receipt name",
    receiptCompany: "Receipt company",
    paymentDate: "Payment date",
    view: "View receipt",
    download: "Download receipt",
    retry: "Retry receipt",
    failedDescription:
      "The payment was completed, but the receipt could not be prepared. Retry to try again.",
    pendingDescription:
      "The receipt is being prepared. Retry if it stays like this for a long time.",
  },

  activity: {
    title: "Activity Timeline",
    description: "Status changes and actions for this payment",
    empty: "No activity logs found",
  },

  toasts: {
    walletUpdateRetried: "Wallet update retry submitted",
    refundRetried: "Refund retry submitted",
    refundStarted: "Refund started",
    nameCheckApproved: "Name check approved — deposit completed",
    nameCheckRejected: "Name check rejected — refund started",
    receiptRetried: "Receipt generation retried",
  },
} as const;

export const EVENT_COPY: Record<string, { title: string; description: string }> = {
  PAYMENT_INITIATED: {
    title: "Payment started",
    description: "A Curlec checkout was created and the local payment record was saved.",
  },
  PAYMENT_CAPTURED: {
    title: "Payment captured",
    description: "Curlec captured the payment. Downstream completion is tracked separately.",
  },
  PAYMENT_FAILED: {
    title: "Payment failed",
    description: "The payment failed before capture.",
  },
  PAYMENT_EXPIRED: {
    title: "Payment expired",
    description: "The payment link timed out before payment was finished.",
  },
  PAYMENT_CAPTURE_MISMATCH_DETECTED: {
    title: "Payment mismatch found",
    description:
      "The payment details did not match what Cashsouk expected. See the status card for amount or currency details.",
  },
  PAYMENT_REFUND_INITIATED: {
    title: "Refund requested",
    description: "A full refund was requested. Waiting for Curlec to confirm the result.",
  },
  PAYMENT_REFUNDED: {
    title: "Refund completed",
    description: "The refund was confirmed. Money was returned to the payer.",
  },
  PAYMENT_REFUND_WALLET_REVERSAL_FAILED: {
    title: "Wallet balance could not be updated",
    description:
      "The refund was completed, but the wallet balance could not be fully updated. Part of the amount may still need attention.",
  },
  PAYMENT_NAME_CHECK_PENDING: {
    title: "Name check needed",
    description:
      "Payment received, but the bank name could not be matched to the investor profile. Waiting for review.",
  },
  PAYMENT_NAME_CHECK_APPROVED: {
    title: "Name check approved",
    description: "The names were confirmed to match. The deposit was completed.",
  },
  PAYMENT_NAME_CHECK_REJECTED: {
    title: "Name check rejected",
    description: "The names did not match. A refund was started only after Curlec accepted it.",
  },
  INVESTOR_DEPOSIT_RECEIVED: {
    title: "Deposit received",
    description: "The investor wallet was credited for this captured payment.",
  },
};

export const REASON_COPY: Record<string, string> = {
  AMOUNT_MISMATCH: "The amount received does not match the amount expected.",
  NAME_MISMATCH: "The bank payer name does not match the investor profile name.",
  NAME_UNAVAILABLE: "The bank did not return a payer name.",
  ADMIN_INITIATED: "A refund was started from Admin.",
  "Curlec captured currency does not match internal payment currency":
    "The payment currency does not match the currency expected by Cashsouk.",
  "External Curlec refund detected on completed payment":
    "A refund was detected from Curlec on a completed payment.",
  "Wallet debit failed after refund": "The wallet balance could not be updated after the refund.",
};

export function formatGatewayEventTitle(type: string, reason?: string | null) {
  const mismatch = type === "PAYMENT_CAPTURE_MISMATCH_DETECTED";
  if (mismatch && (reason === "Currency mismatch" || reason === "CURRENCY_MISMATCH")) {
    return "Currency mismatch found";
  }
  if (mismatch && (reason?.toLowerCase().includes("amount") || reason === "AMOUNT_MISMATCH")) {
    return "Amount mismatch found";
  }
  if (EVENT_COPY[type]) return EVENT_COPY[type].title;
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function looksLikeReasonCode(value: string) {
  return /^[A-Z][A-Z0-9_]+$/.test(value.trim());
}

export function formatGatewayEventDescription(type: string, reason: string | null) {
  if (reason === "Currency mismatch") {
    return "The payment currency does not match the currency expected by Cashsouk. The payment was held for review. No automatic refund was started.";
  }
  if (reason) {
    const trimmed = reason.trim();
    const mapped = REASON_COPY[trimmed];
    if (mapped) return mapped;
    if (!looksLikeReasonCode(trimmed)) return trimmed;
  }
  return EVENT_COPY[type]?.description ?? null;
}
