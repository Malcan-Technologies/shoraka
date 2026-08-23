import { z } from "zod";
import {
  NOTE_AUDIT_EVENTS,
  NOTE_AUDIT_PROVIDER,
  NOTE_PROSPECTUS_INVALIDATION_REASON,
  type NoteAuditEventType,
} from "./events";

const snapshotFields = {
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
};

const statusAxes = {
  previousNoteStatus: z.string().optional(),
  newNoteStatus: z.string().optional(),
  previousListingStatus: z.string().optional(),
  newListingStatus: z.string().optional(),
  previousFundingStatus: z.string().optional(),
  newFundingStatus: z.string().optional(),
  previousServicingStatus: z.string().optional(),
  newServicingStatus: z.string().optional(),
};

const createdSchema = z.object({
  ...snapshotFields,
  sourceType: z.literal("INVOICE"),
  sourceId: z.string(),
  applicationId: z.string(),
  noteReference: z.string(),
  requestedAmount: z.number().optional(),
  targetAmount: z.number().optional(),
  currency: z.string().optional(),
});

const termsSchema = z.object({
  ...snapshotFields,
  changedFields: z.array(z.string()),
  before: z.record(z.unknown()),
  after: z.record(z.unknown()),
});

const prospectusCreatedSchema = z.object({
  ...snapshotFields,
  reviewId: z.string(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
});

const prospectusApprovedSchema = z.object({
  ...snapshotFields,
  reviewId: z.string(),
  publicationId: z.string().optional(),
  contentVersion: z.number().int().optional(),
  pdfSha256: z.string().nullable().optional(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
});

const prospectusInvalidatedSchema = z.object({
  ...snapshotFields,
  reviewId: z.string(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
  reasonCode: z.enum([
    NOTE_PROSPECTUS_INVALIDATION_REASON.SOURCE_CHANGED,
    NOTE_PROSPECTUS_INVALIDATION_REASON.EDIT_AFTER_APPROVAL,
    NOTE_PROSPECTUS_INVALIDATION_REASON.UNPUBLISH,
  ]),
});

const publishedSchema = z.object({
  ...snapshotFields,
  ...statusAxes,
  publicationId: z.string().optional(),
  contentVersion: z.number().int().optional(),
  pdfSha256: z.string().nullable().optional(),
});

const unpublishedSchema = z.object({
  ...snapshotFields,
  ...statusAxes,
});

const campaignPausedSchema = z.object({
  ...snapshotFields,
  ...statusAxes,
  previousIsFeatured: z.boolean().optional(),
  newIsFeatured: z.boolean().optional(),
});

const investmentSchema = z.object({
  ...snapshotFields,
  investmentId: z.string(),
  investorOrganizationId: z.string(),
  amount: z.number(),
  currency: z.string(),
  prospectusPublicationId: z.string().optional(),
});

const fundingSchema = z.object({
  ...snapshotFields,
  ...statusAxes,
  fundedAmount: z.number().optional(),
  targetAmount: z.number().optional(),
});

const servicingSchema = z.object({
  ...snapshotFields,
  previousServicingStatus: z.string(),
  newServicingStatus: z.string(),
  previousNoteStatus: z.string().optional(),
  newNoteStatus: z.string().optional(),
  reasonCode: z.string().optional(),
});

const defaultedSchema = z.object({
  ...snapshotFields,
  previousNoteStatus: z.string(),
  newNoteStatus: z.string(),
  previousServicingStatus: z.string().optional(),
  newServicingStatus: z.string().optional(),
  reason: z.string(),
  effectiveAt: z.string(),
});

const letterSchema = z.object({
  ...snapshotFields,
  documentType: z.string(),
  fileName: z.string().optional(),
  fileHash: z.string().optional(),
  documentId: z.string().optional(),
});

const withdrawalSchema = z.object({
  ...snapshotFields,
  withdrawalId: z.string(),
  withdrawalType: z.string(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
  documentType: z.string().optional(),
  fileName: z.string().optional(),
  fileHash: z.string().optional(),
});

const shorakaSubmittedSchema = z.object({
  ...snapshotFields,
  orderId: z.string(),
  provider: z.literal(NOTE_AUDIT_PROVIDER),
  providerOrderId: z.string().nullable().optional(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
});

const shorakaCertificateSchema = z.object({
  ...snapshotFields,
  orderId: z.string(),
  provider: z.literal(NOTE_AUDIT_PROVIDER),
  providerOrderId: z.string().nullable().optional(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
  certificateSha256: z.string().optional(),
});

const repaymentSchema = z.object({
  ...snapshotFields,
  notePaymentId: z.string(),
  amount: z.number(),
  currency: z.string(),
  source: z.string(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
});

const settlementSchema = z.object({
  ...snapshotFields,
  settlementId: z.string(),
  previousStatus: z.string().optional(),
  newStatus: z.string(),
  settlementAmount: z.number().optional(),
  serviceFeeAmount: z.number().optional(),
  investorAmount: z.number().optional(),
  displayReference: z.string().nullable().optional(),
  investorPayoutCount: z.number().int().optional(),
});

const serviceFeeTrusteeSchema = z.object({
  ...snapshotFields,
  settlementId: z.string(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
  documentType: z.string().optional(),
  fileName: z.string().optional(),
  fileHash: z.string().optional(),
});

const trusteeSignatureSchema = z.object({
  ...snapshotFields,
  artifactId: z.string().nullable().optional(),
  previousArtifactId: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
  contentType: z.string().nullable().optional(),
});

const schemas: Record<NoteAuditEventType, z.ZodType> = {
  NOTE_CREATED: createdSchema,
  NOTE_TERMS_UPDATED: termsSchema,
  NOTE_PROSPECTUS_REVIEW_CREATED: prospectusCreatedSchema,
  NOTE_PROSPECTUS_APPROVED: prospectusApprovedSchema,
  NOTE_PROSPECTUS_INVALIDATED: prospectusInvalidatedSchema,
  NOTE_PUBLISHED: publishedSchema,
  NOTE_UNPUBLISHED: unpublishedSchema,
  NOTE_CAMPAIGN_PAUSED: campaignPausedSchema,
  NOTE_CAMPAIGN_RESUMED: unpublishedSchema,
  INVESTMENT_COMMITTED: investmentSchema,
  NOTE_FUNDING_CLOSED: fundingSchema,
  NOTE_FUNDING_FAILED: fundingSchema,
  NOTE_ACTIVATED: fundingSchema,
  NOTE_SERVICING_STATUS_CHANGED: servicingSchema,
  NOTE_MARKED_DEFAULT: defaultedSchema,
  DISBURSEMENT_INITIATED: withdrawalSchema,
  DISBURSEMENT_LETTER_GENERATED: withdrawalSchema,
  DISBURSEMENT_SUBMITTED_TO_TRUSTEE: withdrawalSchema,
  DISBURSEMENT_BENEFICIARY_UPDATED: withdrawalSchema,
  DISBURSEMENT_COMPLETED: withdrawalSchema,
  RESIDUAL_RETURN_LETTER_GENERATED: withdrawalSchema,
  RESIDUAL_RETURN_SUBMITTED_TO_TRUSTEE: withdrawalSchema,
  RESIDUAL_RETURN_COMPLETED: withdrawalSchema,
  SHORAKA_ORDER_SUBMITTED: shorakaSubmittedSchema,
  SHORAKA_CERTIFICATE_RECEIVED: shorakaCertificateSchema,
  REPAYMENT_SUBMITTED: repaymentSchema,
  REPAYMENT_RECEIVED: repaymentSchema,
  REPAYMENT_REJECTED: repaymentSchema,
  SETTLEMENT_PREVIEWED: settlementSchema,
  SETTLEMENT_APPROVED: settlementSchema,
  SETTLEMENT_POSTED: settlementSchema,
  SERVICE_FEE_TRUSTEE_LETTER_GENERATED: serviceFeeTrusteeSchema,
  SERVICE_FEE_TRUSTEE_SUBMITTED: serviceFeeTrusteeSchema,
  SERVICE_FEE_TRUSTEE_COMPLETED: serviceFeeTrusteeSchema,
  ARREARS_LETTER_GENERATED: letterSchema,
  DEFAULT_NOTICE_GENERATED: letterSchema,
  TRUSTEE_SIGNATURE_UPDATED: trusteeSignatureSchema,
};

export function parseNoteAuditMetadata(
  eventType: NoteAuditEventType,
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const schema = schemas[eventType];
  return schema.parse(metadata) as Record<string, unknown>;
}

export function assertKnownNoteAuditEvent(eventType: string): asserts eventType is NoteAuditEventType {
  if (!(NOTE_AUDIT_EVENTS as readonly string[]).includes(eventType)) {
    throw new Error(`Unknown note audit event: ${eventType}`);
  }
}
