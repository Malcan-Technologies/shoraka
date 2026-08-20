import { z } from "zod";
import { APPLICATION_AUDIT_EVENTS, type ApplicationAuditEventType } from "./events";

const snapshotFields = {
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
};

const previousNewStatus = {
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
};

const createdSchema = z.object({
  ...snapshotFields,
  reviewCycle: z.number().int().optional(),
});

const submittedSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  reviewCycle: z.number().int().optional(),
});

const reviewStartedSchema = z.object({
  ...snapshotFields,
  previousStatus: z.string(),
  newStatus: z.literal("UNDER_REVIEW"),
});

const resubmittedSchema = z.object({
  ...snapshotFields,
  revisionId: z.string().nullable().optional(),
  revisionNumber: z.number().int().optional(),
  changedSections: z.array(z.string()).optional(),
  activitySummary: z.string().optional(),
  reviewCycle: z.number().int().optional(),
});

const amendmentAcknowledgedSchema = z.object({
  ...snapshotFields,
  workflowId: z.string(),
  reviewCycle: z.number().int(),
});

const amendmentsRequestedSchema = z.object({
  ...snapshotFields,
  reviewCycle: z.number().int(),
  count: z.number().int(),
  affectedSections: z.array(z.string()).optional(),
});

const reopenedSchema = z.object({
  ...snapshotFields,
  previousStatus: z.string(),
  newStatus: z.literal("UNDER_REVIEW"),
});

const withdrawnSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  withdrawReason: z.string().optional(),
});

const rejectedSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  reason: z.string().optional(),
});

const archivedSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  archivedAt: z.string().optional(),
});

const draftDeletedSchema = z.object({
  ...snapshotFields,
  previousStatus: z.literal("DRAFT"),
});

const completedSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
});

const sectionReviewSchema = z.object({
  ...snapshotFields,
  section: z.string(),
  previousStatus: z.string(),
  newStatus: z.string(),
  remarks: z.string().optional(),
});

const itemReviewSchema = z.object({
  ...snapshotFields,
  section: z.string().optional(),
  itemId: z.string(),
  previousStatus: z.string(),
  newStatus: z.string(),
  remarks: z.string().optional(),
});

const documentSchema = z.object({
  ...snapshotFields,
  documentCategory: z.string(),
  slotName: z.string().optional(),
  workflowId: z.string().optional(),
  fileName: z.string().optional(),
  fileSizeBytes: z.number().optional(),
  mimeType: z.string().optional(),
  fileHash: z.string().optional(),
});

const offerSentSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  offeredFacility: z.number().optional(),
  offeredAmount: z.number().optional(),
  contractNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
});

const offerRetractedSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  reason: z.string().optional(),
});

const deadlineExtendedSchema = z.object({
  ...snapshotFields,
  previousDeadline: z.string().nullable(),
  newDeadline: z.string(),
  clock: z.literal("SIGNING"),
  reason: z.string().optional(),
});

const offerExpiredSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  clock: z.string().optional(),
  trigger: z.string().optional(),
});

const acceptanceSubmittedSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  submittedAt: z.string().optional(),
});

const acceptanceResubmittedSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  submittedAt: z.string().optional(),
});

const acceptanceChangesSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
});

const acceptanceApprovedSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  autoApproved: z.boolean().optional(),
});

const offerAcceptedSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  completionMethod: z.enum(["DIRECT_ACCEPTANCE", "SIGNING_COMPLETION"]),
  signingEnvelopeId: z.string().optional(),
});

const offerRejectedSchema = z.object({
  ...snapshotFields,
  decision: z.literal("rejected"),
  previousStatus: z.string(),
  newStatus: z.string(),
  withdrawReason: z.literal("OFFER_REJECTED"),
  reason: z.string().optional(),
});

const contractWithdrawnSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  withdrawReason: z.string().optional(),
});

const largePrivateSchema = z.object({
  ...snapshotFields,
  previousValue: z.boolean(),
  newValue: z.boolean(),
});

const invoiceWithdrawnSchema = z.object({
  ...snapshotFields,
  ...previousNewStatus,
  withdrawReason: z.string().optional(),
  invoiceNumber: z.string().optional(),
});

const occupancyAmountsSchema = z.object({
  utilized_facility: z.number(),
  available_facility: z.number(),
  repaid_facility: z.number(),
});

const occupancyUpdatedSchema = z.object({
  ...snapshotFields,
  reason: z.enum(["INVOICE_ACCEPTED", "FUNDING_CLOSED", "FUNDING_FAILED", "NOTE_REPAID"]),
  contract_id: z.string(),
  note_id: z.string().nullable(),
  invoice_id: z.string().nullable(),
  before: occupancyAmountsSchema,
  after: occupancyAmountsSchema.extend({
    pending_facility: z.number(),
  }),
});

const metadataByEvent = {
  APPLICATION_CREATED: createdSchema,
  APPLICATION_SUBMITTED: submittedSchema,
  APPLICATION_REVIEW_STARTED: reviewStartedSchema,
  APPLICATION_RESUBMITTED: resubmittedSchema,
  APPLICATION_AMENDMENT_ACKNOWLEDGED: amendmentAcknowledgedSchema,
  APPLICATION_AMENDMENTS_REQUESTED: amendmentsRequestedSchema,
  APPLICATION_REOPENED_FOR_REVIEW: reopenedSchema,
  APPLICATION_WITHDRAWN: withdrawnSchema,
  APPLICATION_REJECTED: rejectedSchema,
  APPLICATION_ARCHIVED: archivedSchema,
  APPLICATION_DRAFT_DELETED: draftDeletedSchema,
  APPLICATION_COMPLETED: completedSchema,
  APPLICATION_SECTION_REVIEW_UPDATED: sectionReviewSchema,
  APPLICATION_ITEM_REVIEW_UPDATED: itemReviewSchema,
  APPLICATION_DOCUMENT_UPLOADED: documentSchema,
  APPLICATION_DOCUMENT_REMOVED: documentSchema,
  APPLICATION_DOCUMENT_REPLACED: documentSchema,
  CONTRACT_OFFER_SENT: offerSentSchema,
  CONTRACT_OFFER_RETRACTED: offerRetractedSchema,
  CONTRACT_SIGNING_DEADLINE_EXTENDED: deadlineExtendedSchema,
  CONTRACT_OFFER_EXPIRED: offerExpiredSchema,
  CONTRACT_ACCEPTANCE_SUBMITTED: acceptanceSubmittedSchema,
  CONTRACT_ACCEPTANCE_RESUBMITTED: acceptanceResubmittedSchema,
  CONTRACT_ACCEPTANCE_CHANGES_REQUESTED: acceptanceChangesSchema,
  CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING: acceptanceApprovedSchema,
  CONTRACT_OFFER_ACCEPTED: offerAcceptedSchema,
  CONTRACT_OFFER_REJECTED: offerRejectedSchema,
  CONTRACT_WITHDRAWN: contractWithdrawnSchema,
  CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED: largePrivateSchema,
  INVOICE_OFFER_SENT: offerSentSchema,
  INVOICE_OFFER_RETRACTED: offerRetractedSchema,
  INVOICE_SIGNING_DEADLINE_EXTENDED: deadlineExtendedSchema,
  INVOICE_OFFER_EXPIRED: offerExpiredSchema,
  INVOICE_ACCEPTANCE_SUBMITTED: acceptanceSubmittedSchema,
  INVOICE_ACCEPTANCE_RESUBMITTED: acceptanceResubmittedSchema,
  INVOICE_ACCEPTANCE_CHANGES_REQUESTED: acceptanceChangesSchema,
  INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING: acceptanceApprovedSchema,
  INVOICE_OFFER_ACCEPTED: offerAcceptedSchema,
  INVOICE_OFFER_REJECTED: offerRejectedSchema,
  INVOICE_WITHDRAWN: invoiceWithdrawnSchema,
  CONTRACT_FACILITY_OCCUPANCY_UPDATED: occupancyUpdatedSchema,
} as const satisfies Record<ApplicationAuditEventType, z.ZodTypeAny>;

export function parseApplicationAuditMetadata(
  eventType: ApplicationAuditEventType,
  metadata: unknown
): Record<string, unknown> {
  return metadataByEvent[eventType].parse(metadata) as Record<string, unknown>;
}

export function isApplicationAuditEventType(value: string): value is ApplicationAuditEventType {
  return (APPLICATION_AUDIT_EVENTS as readonly string[]).includes(value);
}
