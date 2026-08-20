export const SIGNING_AUDIT_EVENTS = [
  "SIGNING_PACKAGE_CREATED",
  "SIGNING_PACKAGE_SENT",
  "SIGNING_PACKAGE_COMPLETED",
  "SIGNING_PACKAGE_VOIDED",
  "SIGNING_PACKAGE_DECLINED",
  "SIGNING_PACKAGE_EXPIRED",
  "SIGNING_RECIPIENT_COMPLETED",
  "SIGNING_RECIPIENT_DECLINED",
  "SIGNING_EKYC_STARTED",
  "SIGNING_EKYC_VERIFIED",
  "SIGNING_EKYC_FAILED",
  "SIGNING_REMINDER_SENT",
] as const;

export type SigningAuditEventType = (typeof SIGNING_AUDIT_EVENTS)[number];

export const SIGNING_AUDIT_TARGET_TYPE = {
  ENVELOPE: "ENVELOPE",
  RECIPIENT: "RECIPIENT",
  DOCUMENT: "DOCUMENT",
  EKYC_SESSION: "EKYC_SESSION",
} as const;

export type SigningAuditTargetType =
  (typeof SIGNING_AUDIT_TARGET_TYPE)[keyof typeof SIGNING_AUDIT_TARGET_TYPE];

export const SIGNING_COMPLETION_METHOD = {
  WEBHOOK: "WEBHOOK",
  TRUST_RETURN: "TRUST_RETURN",
  RECONCILE: "RECONCILE",
  MANUAL_SYNC: "MANUAL_SYNC",
} as const;

export type SigningCompletionMethod =
  (typeof SIGNING_COMPLETION_METHOD)[keyof typeof SIGNING_COMPLETION_METHOD];

export const SIGNING_EXPIRY_TRIGGER = {
  ENVELOPE_CLOCK: "ENVELOPE_CLOCK",
  OFFER_SIGNING_CLOCK: "OFFER_SIGNING_CLOCK",
} as const;

export type SigningExpiryTrigger =
  (typeof SIGNING_EXPIRY_TRIGGER)[keyof typeof SIGNING_EXPIRY_TRIGGER];

export interface SigningAuditActor {
  type: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
}

export interface SigningAuditLogDto {
  id: string;
  eventType: SigningAuditEventType;
  occurredAt: string;
  createdAt: string;
  actor: SigningAuditActor;
  organizationId: string | null;
  organizationKind: string | null;
  target: { type: string; id: string };
  source: string;
  portal: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
  signingEnvelopeId: string | null;
  applicationId: string | null;
}
