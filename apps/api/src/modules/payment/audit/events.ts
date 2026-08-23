export const PAYMENT_AUDIT_EVENTS = [
  "PAYMENT_INITIATED",
  "PAYMENT_CAPTURED",
  "PAYMENT_FAILED",
  "PAYMENT_EXPIRED",
  "PAYMENT_CAPTURE_MISMATCH_DETECTED",
  "PAYMENT_REFUND_INITIATED",
  "PAYMENT_REFUNDED",
  "PAYMENT_REFUND_WALLET_REVERSAL_FAILED",
  "PAYMENT_NAME_CHECK_PENDING",
  "PAYMENT_NAME_CHECK_APPROVED",
  "PAYMENT_NAME_CHECK_REJECTED",
  "INVESTOR_DEPOSIT_RECEIVED",
  "INVESTOR_WITHDRAWAL_REQUESTED",
  "INVESTOR_WITHDRAWAL_LETTER_GENERATED",
  "INVESTOR_WITHDRAWAL_BENEFICIARY_UPDATED",
  "INVESTOR_WITHDRAWAL_SUBMITTED_TO_TRUSTEE",
  "INVESTOR_WITHDRAWAL_COMPLETED",
  "PAYMENT_RECONCILIATION_EXCEPTION_DETECTED",
  "PAYMENT_RECONCILIATION_EXCEPTION_RESOLVED",
] as const;

export type PaymentAuditEventType = (typeof PAYMENT_AUDIT_EVENTS)[number];

export const PAYMENT_AUDIT_TARGET_TYPE = {
  GATEWAY_PAYMENT: "GATEWAY_PAYMENT",
  WITHDRAWAL: "WITHDRAWAL",
  BALANCE_TRANSACTION: "BALANCE_TRANSACTION",
  RECON_EXCEPTION: "RECON_EXCEPTION",
} as const;

export type PaymentAuditTargetType =
  (typeof PAYMENT_AUDIT_TARGET_TYPE)[keyof typeof PAYMENT_AUDIT_TARGET_TYPE];

export const PAYMENT_AUDIT_PROVIDER = "CURLEC" as const;

export const PAYMENT_AUDIT_CURRENCY = "MYR" as const;

export function isPaymentAuditEventType(value: string): value is PaymentAuditEventType {
  return (PAYMENT_AUDIT_EVENTS as readonly string[]).includes(value);
}

export const PAYMENT_AUDIT_IDEMPOTENCY = {
  initiated: (gatewayPaymentId: string) => `payment-audit:initiated:${gatewayPaymentId}`,
  captured: (gatewayPaymentId: string) => `payment-audit:captured:${gatewayPaymentId}`,
  failed: (gatewayPaymentId: string) => `payment-audit:failed:${gatewayPaymentId}`,
  expired: (gatewayPaymentId: string) => `payment-audit:expired:${gatewayPaymentId}`,
  captureMismatch: (gatewayPaymentId: string) =>
    `payment-audit:capture-mismatch:${gatewayPaymentId}`,
  refundInitiated: (gatewayPaymentId: string, refundId?: string | null) =>
    `payment-audit:refund-initiated:${gatewayPaymentId}:${refundId ?? "pending"}`,
  refunded: (gatewayPaymentId: string) => `payment-audit:refunded:${gatewayPaymentId}`,
  walletReversalFailed: (gatewayPaymentId: string) =>
    `payment-audit:wallet-reversal-failed:${gatewayPaymentId}`,
  nameCheckPending: (gatewayPaymentId: string) =>
    `payment-audit:name-check-pending:${gatewayPaymentId}`,
  nameCheckApproved: (gatewayPaymentId: string) =>
    `payment-audit:name-check-approved:${gatewayPaymentId}`,
  nameCheckRejected: (gatewayPaymentId: string) =>
    `payment-audit:name-check-rejected:${gatewayPaymentId}`,
  depositReceived: (gatewayPaymentId: string) =>
    `payment-audit:deposit-received:${gatewayPaymentId}`,
  withdrawalRequested: (withdrawalId: string) =>
    `payment-audit:withdrawal-requested:${withdrawalId}`,
  withdrawalLetter: (withdrawalId: string) => `payment-audit:withdrawal-letter:${withdrawalId}`,
  withdrawalBeneficiary: (withdrawalId: string, changeKey: string) =>
    `payment-audit:withdrawal-beneficiary:${withdrawalId}:${changeKey}`,
  withdrawalSubmitted: (withdrawalId: string) =>
    `payment-audit:withdrawal-submitted:${withdrawalId}`,
  withdrawalCompleted: (withdrawalId: string) =>
    `payment-audit:withdrawal-completed:${withdrawalId}`,
  reconDetected: (gatewayAccount: string, providerReference: string, mismatchType: string) =>
    `payment-audit:recon-detected:${gatewayAccount}:${providerReference}:${mismatchType}`,
  reconResolved: (exceptionId: string) => `payment-audit:recon-resolved:${exceptionId}`,
} as const;
