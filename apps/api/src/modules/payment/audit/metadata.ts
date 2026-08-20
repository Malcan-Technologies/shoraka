import { z } from "zod";
import {
  PAYMENT_AUDIT_EVENTS,
  PAYMENT_AUDIT_PROVIDER,
  type PaymentAuditEventType,
} from "./events";

const snapshotFields = {
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
};

const initiatedSchema = z.object({
  ...snapshotFields,
  purpose: z.string(),
  amount: z.number(),
  currency: z.string(),
  provider: z.literal(PAYMENT_AUDIT_PROVIDER),
  gatewayAccount: z.string(),
  providerOrderId: z.string(),
});

const capturedSchema = z.object({
  ...snapshotFields,
  purpose: z.string(),
  amount: z.number(),
  currency: z.string(),
  provider: z.literal(PAYMENT_AUDIT_PROVIDER),
  gatewayAccount: z.string(),
  providerPaymentId: z.string().nullable().optional(),
  providerOrderId: z.string(),
  capturedAt: z.string(),
});

const statusChangeSchema = z.object({
  ...snapshotFields,
  purpose: z.string(),
  previousStatus: z.string(),
  newStatus: z.string(),
  reason: z.string().optional(),
});

const mismatchSchema = z.object({
  ...snapshotFields,
  mismatchType: z.string(),
  expectedAmount: z.number().optional(),
  expectedSen: z.number().optional(),
  actualAmount: z.number().optional(),
  actualSen: z.number().optional(),
  expectedCurrency: z.string().nullable().optional(),
  actualCurrency: z.string().nullable().optional(),
  currency: z.string().optional(),
  providerPaymentId: z.string().nullable().optional(),
  providerOrderId: z.string().nullable().optional(),
});

const refundSchema = z.object({
  ...snapshotFields,
  amount: z.number(),
  currency: z.string(),
  purpose: z.string(),
  providerReference: z.string().nullable().optional(),
  reason: z.string().optional(),
  previousStatus: z.string(),
  newStatus: z.string(),
});

const walletReversalFailedSchema = z.object({
  ...snapshotFields,
  refundId: z.string().nullable().optional(),
  blockedAmount: z.number().optional(),
  failureCode: z.string().nullable().optional(),
  fundsProtected: z.boolean(),
  balanceTransactionId: z.string().nullable().optional(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
});

const nameCheckSchema = z.object({
  ...snapshotFields,
  result: z.string(),
  score: z.number().optional(),
  previousStatus: z.string(),
  newStatus: z.string(),
  gatewayPaymentId: z.string(),
});

const depositReceivedSchema = z.object({
  ...snapshotFields,
  balanceTransactionId: z.string(),
  amount: z.number(),
  currency: z.string(),
  previousBalance: z.number().optional(),
  newBalance: z.number().optional(),
  gatewayPaymentId: z.string(),
});

const withdrawalSchema = z.object({
  ...snapshotFields,
  withdrawalId: z.string(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  previousStatus: z.string().optional(),
  newStatus: z.string(),
  changedFields: z.array(z.string()).optional(),
  fileName: z.string().optional(),
  fileHash: z.string().optional(),
  documentType: z.string().optional(),
});

const reconSchema = z.object({
  ...snapshotFields,
  exceptionId: z.string(),
  mismatchType: z.string(),
  providerReference: z.string().nullable().optional(),
  internalReference: z.string().nullable().optional(),
  runId: z.string(),
});

const schemas: Record<PaymentAuditEventType, z.ZodType> = {
  PAYMENT_INITIATED: initiatedSchema,
  PAYMENT_CAPTURED: capturedSchema,
  PAYMENT_FAILED: statusChangeSchema,
  PAYMENT_EXPIRED: statusChangeSchema,
  PAYMENT_CAPTURE_MISMATCH_DETECTED: mismatchSchema,
  PAYMENT_REFUND_INITIATED: refundSchema,
  PAYMENT_REFUNDED: refundSchema,
  PAYMENT_REFUND_WALLET_REVERSAL_FAILED: walletReversalFailedSchema,
  PAYMENT_NAME_CHECK_PENDING: nameCheckSchema,
  PAYMENT_NAME_CHECK_APPROVED: nameCheckSchema,
  PAYMENT_NAME_CHECK_REJECTED: nameCheckSchema,
  INVESTOR_DEPOSIT_RECEIVED: depositReceivedSchema,
  INVESTOR_WITHDRAWAL_REQUESTED: withdrawalSchema,
  INVESTOR_WITHDRAWAL_LETTER_GENERATED: withdrawalSchema,
  INVESTOR_WITHDRAWAL_BENEFICIARY_UPDATED: withdrawalSchema,
  INVESTOR_WITHDRAWAL_SUBMITTED_TO_TRUSTEE: withdrawalSchema,
  INVESTOR_WITHDRAWAL_COMPLETED: withdrawalSchema,
  PAYMENT_RECONCILIATION_EXCEPTION_DETECTED: reconSchema,
  PAYMENT_RECONCILIATION_EXCEPTION_RESOLVED: reconSchema,
};

export function parsePaymentAuditMetadata(
  eventType: PaymentAuditEventType,
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const schema = schemas[eventType];
  return schema.parse(metadata) as Record<string, unknown>;
}

export function assertKnownPaymentAuditEvent(
  eventType: string
): asserts eventType is PaymentAuditEventType {
  if (!(PAYMENT_AUDIT_EVENTS as readonly string[]).includes(eventType)) {
    throw new Error(`Unknown payment audit event: ${eventType}`);
  }
}
