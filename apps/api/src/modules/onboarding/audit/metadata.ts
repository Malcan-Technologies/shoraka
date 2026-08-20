import { z } from "zod";
import { ONBOARDING_AUDIT_EVENTS, type OnboardingAuditEventType } from "./events";

const snapshotFields = {
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
};

const startedSchema = z.object({
  ...snapshotFields,
  requestId: z.string(),
  onboardingType: z.enum(["INDIVIDUAL", "CORPORATE"]),
  previousOrgStatus: z.string().optional(),
});

const resumedSchema = z.object({
  ...snapshotFields,
  requestId: z.string(),
  onboardingType: z.enum(["INDIVIDUAL", "CORPORATE"]),
  previousOrgStatus: z.string().optional(),
  newStatus: z.string().optional(),
});

const restartedSchema = z.object({
  ...snapshotFields,
  trigger: z.enum(["EXPIRED_SESSION", "STALE_SESSION", "ADMIN_RESTART"]),
  previousRequestId: z.string().optional(),
  newRequestId: z.string(),
  previousStatus: z.string().optional(),
  onboardingType: z.enum(["INDIVIDUAL", "CORPORATE"]).optional(),
});

const resetSchema = z.object({
  ...snapshotFields,
  statusScope: z.literal("USER_ACCOUNT_MARKER"),
  organizationStateReset: z.literal(false),
  portal: z.string(),
  previousAccountMarker: z.array(z.string()),
  newAccountMarker: z.array(z.string()),
});

const userMarkerSchema = z.object({
  ...snapshotFields,
  portal: z.string(),
  previousAccountMarker: z.array(z.string()),
  newAccountMarker: z.array(z.string()),
});

const statusChangedSchema = z.object({
  ...snapshotFields,
  previousStatus: z.string(),
  newStatus: z.string(),
  trigger: z.string().optional(),
  reasonCode: z.string().optional(),
});

const approvedSchema = z.object({
  ...snapshotFields,
  previousApproved: z.boolean(),
  newApproved: z.boolean(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
  trigger: z.string().optional(),
});

const rejectedSchema = z.object({
  ...snapshotFields,
  previousStatus: z.string(),
  newStatus: z.string(),
  provider: z.literal("REGTANK"),
  sourceFamily: z.enum(["COD", "INDIVIDUAL"]),
  reasonCode: z.string().optional(),
});

const finalApprovalSchema = z.object({
  ...snapshotFields,
  previousStatus: z.string(),
  newStatus: z.string(),
  approvedBy: z.string().optional(),
});

const completedSchema = z.object({
  ...snapshotFields,
  completionMethod: z.literal("LEGACY_COMPLETE_ONBOARDING"),
  previousStatus: z.string(),
  newStatus: z.string(),
});

const amlApprovedSchema = z.object({
  ...snapshotFields,
  provider: z.string(),
  screeningKind: z.enum(["KYC", "KYB"]).optional(),
  providerReference: z.string().optional(),
  previousApproved: z.boolean(),
  newApproved: z.boolean(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
  trigger: z.string().optional(),
});

const ssmApprovedSchema = z.object({
  ...snapshotFields,
  previousSsmApproved: z.boolean(),
  newSsmApproved: z.boolean(),
  previousStatus: z.string(),
  newStatus: z.string(),
});

const sophisticatedSchema = z.object({
  ...snapshotFields,
  previousValue: z.boolean(),
  newValue: z.boolean(),
  previousReason: z.string().nullable().optional(),
  newReason: z.string().nullable().optional(),
  action: z.enum(["AUTO_GRANTED", "GRANTED", "REVOKED"]),
});

const ctosReceivedSchema = z.object({
  ...snapshotFields,
  reportId: z.string(),
  entityType: z.string(),
  provider: z.literal("CTOS"),
});

const corporateEntitiesSchema = z.object({
  ...snapshotFields,
  addedCount: z.number(),
  removedCount: z.number(),
  updatedCount: z.number(),
  changedFields: z.array(z.string()).optional(),
});

const directorInvitationSchema = z.object({
  ...snapshotFields,
  directorEmail: z.string(),
  partyKey: z.string().optional(),
  requestId: z.string().optional(),
});

const directorKycSchema = z.object({
  ...snapshotFields,
  previousKycStatus: z.string().optional(),
  newKycStatus: z.string().optional(),
  eodRequestId: z.string().optional(),
  partyKey: z.string().optional(),
  directorName: z.string().optional(),
  changedCount: z.number().optional(),
  directorCount: z.number().optional(),
});

const jsonScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const organizationProfileUpdatedSchema = z.object({
  ...snapshotFields,
  changedFields: z.array(z.string()),
  before: z.record(jsonScalar),
  after: z.record(jsonScalar),
  bankAccountDetailsChanged: z.boolean(),
  corporateOnboardingChangedFields: z.array(z.string()).optional(),
});

const metadataByEvent = {
  ONBOARDING_STARTED: startedSchema,
  ONBOARDING_RESUMED: resumedSchema,
  ONBOARDING_RESTARTED: restartedSchema,
  ONBOARDING_RESET: resetSchema,
  USER_ONBOARDING_STATUS_UPDATED: userMarkerSchema,
  ONBOARDING_STATUS_CHANGED: statusChangedSchema,
  ONBOARDING_APPROVED: approvedSchema,
  ONBOARDING_REJECTED: rejectedSchema,
  ONBOARDING_FINAL_APPROVAL_COMPLETED: finalApprovalSchema,
  ONBOARDING_COMPLETED: completedSchema,
  AML_APPROVED: amlApprovedSchema,
  SSM_APPROVED: ssmApprovedSchema,
  INVESTOR_SOPHISTICATED_STATUS_UPDATED: sophisticatedSchema,
  CTOS_REPORT_RECEIVED: ctosReceivedSchema,
  CORPORATE_ENTITIES_UPDATED: corporateEntitiesSchema,
  DIRECTOR_ONBOARDING_INVITATION_SENT: directorInvitationSchema,
  DIRECTOR_KYC_STATUS_UPDATED: directorKycSchema,
  ORGANIZATION_PROFILE_UPDATED_BY_ADMIN: organizationProfileUpdatedSchema,
} as const;

export function parseOnboardingAuditMetadata(
  eventType: OnboardingAuditEventType,
  metadata: unknown
): Record<string, unknown> {
  return metadataByEvent[eventType].parse(metadata) as Record<string, unknown>;
}

export function isOnboardingAuditEventType(value: string): value is OnboardingAuditEventType {
  return (ONBOARDING_AUDIT_EVENTS as readonly string[]).includes(value);
}
