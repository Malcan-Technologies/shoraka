import { z } from "zod";
import {
  SIGNING_COMPLETION_METHOD,
  SIGNING_EXPIRY_TRIGGER,
  SIGNING_PROVIDER,
  type SigningAuditEventType,
} from "./events";

const snapshotFields = {
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
};

const createdSchema = z.object({
  ...snapshotFields,
  applicationId: z.string(),
  contractId: z.string().optional(),
  invoiceId: z.string().optional(),
  provider: z.literal(SIGNING_PROVIDER),
  recipientCount: z.number().int(),
  documentCount: z.number().int(),
});

const sentSchema = z.object({
  ...snapshotFields,
  provider: z.literal(SIGNING_PROVIDER),
  sentAt: z.string(),
  recipientCount: z.number().int(),
});

const completedSchema = z.object({
  ...snapshotFields,
  provider: z.literal(SIGNING_PROVIDER),
  completedAt: z.string(),
  completionMethod: z.enum([
    SIGNING_COMPLETION_METHOD.WEBHOOK,
    SIGNING_COMPLETION_METHOD.TRUST_RETURN,
    SIGNING_COMPLETION_METHOD.RECONCILE,
    SIGNING_COMPLETION_METHOD.MANUAL_SYNC,
  ]),
  signedDocumentHashes: z.array(
    z.object({
      documentId: z.string(),
      sha256: z.string(),
    })
  ),
});

const voidedSchema = z.object({
  ...snapshotFields,
  previousStatus: z.string(),
  newStatus: z.literal("VOIDED"),
  reason: z.string().optional(),
});

const declinedSchema = z.object({
  ...snapshotFields,
  previousStatus: z.string(),
  newStatus: z.literal("DECLINED"),
  provider: z.literal(SIGNING_PROVIDER),
  decliningRecipientId: z.string().optional(),
  reasonCode: z.string().optional(),
});

const expiredSchema = z.object({
  ...snapshotFields,
  previousStatus: z.string(),
  newStatus: z.literal("EXPIRED"),
  expiresAt: z.string().nullable(),
  trigger: z.enum([
    SIGNING_EXPIRY_TRIGGER.ENVELOPE_CLOCK,
    SIGNING_EXPIRY_TRIGGER.OFFER_SIGNING_CLOCK,
  ]),
});

const recipientSchema = z.object({
  ...snapshotFields,
  recipientId: z.string(),
  recipientRole: z.string(),
  signerOrder: z.number().int().optional(),
  previousStatus: z.string(),
  newStatus: z.string(),
});

const ekycSchema = z.object({
  ...snapshotFields,
  recipientId: z.string().optional(),
  email: z.string(),
  provider: z.literal(SIGNING_PROVIDER),
  previousStatus: z.string().optional(),
  newStatus: z.string(),
  reasonCode: z.string().optional(),
});

const reminderSchema = z.object({
  ...snapshotFields,
  recipientId: z.string(),
  recipientEmail: z.string().optional(),
  reminderType: z.literal("MANUAL"),
});

const metadataByEvent = {
  SIGNING_PACKAGE_CREATED: createdSchema,
  SIGNING_PACKAGE_SENT: sentSchema,
  SIGNING_PACKAGE_COMPLETED: completedSchema,
  SIGNING_PACKAGE_VOIDED: voidedSchema,
  SIGNING_PACKAGE_DECLINED: declinedSchema,
  SIGNING_PACKAGE_EXPIRED: expiredSchema,
  SIGNING_RECIPIENT_COMPLETED: recipientSchema,
  SIGNING_RECIPIENT_DECLINED: recipientSchema,
  SIGNING_EKYC_STARTED: ekycSchema,
  SIGNING_EKYC_VERIFIED: ekycSchema,
  SIGNING_EKYC_FAILED: ekycSchema,
  SIGNING_REMINDER_SENT: reminderSchema,
} as const satisfies Record<SigningAuditEventType, z.ZodTypeAny>;

export function parseSigningAuditMetadata(
  eventType: SigningAuditEventType,
  metadata: unknown
): Record<string, unknown> {
  return metadataByEvent[eventType].parse(metadata) as Record<string, unknown>;
}
