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

export interface PaymentAuditActor {
  type: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
}

export interface PaymentAuditLogDto {
  id: string;
  gatewayPaymentId: string | null;
  eventType: PaymentAuditEventType | string;
  occurredAt: string;
  createdAt: string;
  actor: PaymentAuditActor;
  organizationId: string | null;
  organizationKind: string | null;
  target: { type: string; id: string };
  source: string;
  portal: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
}
