export const PAYMASTER_ASSIGNMENT_NOTICE_STATUSES = [
  "GENERATED",
  "SENT",
  "ACKNOWLEDGEMENT_UPLOADED",
  "ACKNOWLEDGED",
  "FAILED",
] as const;

export type PaymasterAssignmentNoticeStatus =
  (typeof PAYMASTER_ASSIGNMENT_NOTICE_STATUSES)[number];

export const PAYMASTER_VERIFICATION_STATUSES = ["UNVERIFIED", "VERIFIED"] as const;
export type PaymasterVerificationStatus = (typeof PAYMASTER_VERIFICATION_STATUSES)[number];

export const PAYMASTER_LOOKUP_STATUSES = [
  "FOUND_VERIFIED",
  "FOUND_UNVERIFIED",
  "NOT_FOUND",
] as const;
export type PaymasterLookupStatus = (typeof PAYMASTER_LOOKUP_STATUSES)[number];

export function isPaymasterVerified(
  status: PaymasterVerificationStatus | string | null | undefined
): boolean {
  return status === "VERIFIED";
}

export interface PaymasterMasterIdentity {
  id: string;
  legalName: string;
  registrationNumber: string;
  registrationCountry: string;
  entityType: string;
  verificationStatus: PaymasterVerificationStatus;
}

export interface PaymasterIdentity extends PaymasterMasterIdentity {
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymasterListItem extends PaymasterIdentity {
  linkedIssuerCount: number;
  linkedNoteCount: number;
  linkedFacilityCount: number;
  noticeCount: number;
  lastUsedAt: string | null;
  latestIssuerName: string | null;
}

export function paymasterLinkedFinancingCount(item: {
  linkedFacilityCount: number;
  linkedNoteCount: number;
}): number {
  return item.linkedFacilityCount + item.linkedNoteCount;
}

export interface PaymasterIssuerLinkRow {
  issuerOrganizationId: string;
  issuerName: string | null;
  issuerDisplayReference: string | null;
  isRelatedParty: boolean | null;
  lastUsedAt: string;
}

export interface PaymasterFinancingRow {
  applicationId: string | null;
  applicationDisplayReference: string | null;
  contractId: string | null;
  contractDisplayReference: string | null;
  invoiceId: string | null;
  invoiceDisplayReference: string | null;
  noteId: string | null;
  noteReference: string | null;
  issuerOrganizationId: string;
  issuerName: string | null;
  status: string | null;
  amount: number | null;
  updatedAt: string | null;
}

export interface PaymasterNoticeHistoryRow {
  id: string;
  status: PaymasterAssignmentNoticeStatus;
  version: number;
  issuerOrganizationId: string;
  issuerName: string | null;
  contractId: string | null;
  contractDisplayReference: string | null;
  invoiceId: string | null;
  invoiceDisplayReference: string | null;
  noteId: string | null;
  noteReference: string | null;
  generatedAt: string | null;
  sentAt: string | null;
  acknowledgedAt: string | null;
}

export interface PaymasterDetail extends PaymasterIdentity {
  source: string;
  verifiedByName: string | null;
  issuers: PaymasterIssuerLinkRow[];
  financings: PaymasterFinancingRow[];
  notices: PaymasterNoticeHistoryRow[];
}

/** Identity lifecycle events stored on `application_logs` and read from Application and Paymaster Activity. */
export const PAYMASTER_IDENTITY_ACTIVITY_EVENT_TYPES = [
  "PAYMASTER_CREATED",
  "PAYMASTER_LINKED_TO_ISSUER",
  "PAYMASTER_VERIFIED",
  "PAYMASTER_IDENTITY_RESOLVED",
] as const;

export type PaymasterIdentityActivityEventType =
  (typeof PAYMASTER_IDENTITY_ACTIVITY_EVENT_TYPES)[number];

export function isPaymasterIdentityActivityEventType(
  eventType: string
): eventType is PaymasterIdentityActivityEventType {
  return (PAYMASTER_IDENTITY_ACTIVITY_EVENT_TYPES as readonly string[]).includes(eventType);
}

/** One `application_logs` row for a Paymaster master. Same record as Application Activity. */
export interface PaymasterActivityEvent {
  id: string;
  eventType: PaymasterIdentityActivityEventType;
  createdAt: string;
  remark: string | null;
  actorUserId: string | null;
  actorName: string | null;
  portal: string | null;
  paymasterId: string;
  issuerOrganizationId: string | null;
  issuerName: string | null;
  issuerDisplayReference: string | null;
  applicationId: string | null;
  applicationDisplayReference: string | null;
  applicationProductId: string | null;
  relatedParty: boolean | null;
  verificationStatus: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  metadata: Record<string, unknown> | null;
}

export interface IssuerPaymasterOption {
  id: string;
  legalName: string;
  registrationNumber: string;
  registrationCountry: string;
  entityType: string;
  verificationStatus: PaymasterVerificationStatus;
  isRelatedParty: boolean | null;
  lastUsedAt: string;
}

export interface PaymasterLookupMatch {
  id: string;
  legalName: string;
  registrationNumber: string;
  registrationCountry: string;
  entityType: string;
  verificationStatus: PaymasterVerificationStatus;
}

export interface PaymasterLookupResult {
  status: PaymasterLookupStatus;
  paymaster: PaymasterLookupMatch | null;
}

export interface PaymasterAssignmentNotice {
  id: string;
  paymasterId: string;
  issuerOrganizationId: string;
  contractId: string | null;
  invoiceId: string | null;
  noteId: string | null;
  status: PaymasterAssignmentNoticeStatus;
  version: number;
  noticeFileName: string | null;
  noticeS3Key: string | null;
  generatedAt: string | null;
  sentAt: string | null;
  acknowledgementFileName: string | null;
  acknowledgementUploadedAt: string | null;
  acknowledgedAt: string | null;
  templatePending: boolean;
  generationError: string | null;
}

export const PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_CODE = "PAYMASTER_ACKNOWLEDGEMENT_REQUIRED";
export const PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_MESSAGE =
  "Paymaster acknowledgement of the Notice of Assignment is required before disbursement.";

export const PAYMASTER_NOT_VERIFIED_CODE = "PAYMASTER_NOT_VERIFIED";
export const PAYMASTER_NOT_VERIFIED_MESSAGE =
  "You can only select a verified Paymaster for reuse.";
export const PAYMASTER_NOT_VERIFIED_FOR_OFFER_MESSAGE =
  "Verify Paymaster identity before sending an offer.";
export const PAYMASTER_NOT_VERIFIED_FOR_USE_VERIFIED_MESSAGE =
  "Verify Paymaster identity before using the verified record.";

export const PAYMASTER_NOT_LINKED_CODE = "PAYMASTER_NOT_LINKED";
export const PAYMASTER_NOT_LINKED_MESSAGE = "This application has no linked Paymaster.";

export const PAYMASTER_IDENTITY_UNRESOLVED_CODE = "PAYMASTER_IDENTITY_UNRESOLVED";
export const PAYMASTER_IDENTITY_UNRESOLVED_MESSAGE =
  "Resolve submitted vs verified Paymaster identity before sending an offer.";

export type PaymasterIdentityFields = {
  name: string;
  entity_type: string;
  ssm_number: string;
  country: string;
};

function identityText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function paymasterMasterIdentityFields(paymaster: {
  legalName?: string | null;
  legal_name?: string | null;
  entityType?: string | null;
  entity_type?: string | null;
  registrationNumber?: string | null;
  registration_number?: string | null;
  registrationCountry?: string | null;
  registration_country?: string | null;
}): PaymasterIdentityFields {
  return {
    name: identityText(paymaster.legalName ?? paymaster.legal_name),
    entity_type: identityText(paymaster.entityType ?? paymaster.entity_type),
    ssm_number: identityText(paymaster.registrationNumber ?? paymaster.registration_number),
    country: identityText(paymaster.registrationCountry ?? paymaster.registration_country),
  };
}

export function submittedIdentityDiffersFromVerified(params: {
  submitted?: {
    name?: unknown;
    entity_type?: unknown;
    ssm_number?: unknown;
    country?: unknown;
  } | null;
  paymaster?:
    | (Parameters<typeof paymasterMasterIdentityFields>[0] & {
        verificationStatus?: string | null;
        verification_status?: string | null;
      })
    | null;
}): boolean {
  if (!params.paymaster) return false;
  const status = params.paymaster.verificationStatus ?? params.paymaster.verification_status;
  if (!isPaymasterVerified(status)) return false;
  const verified = paymasterMasterIdentityFields(params.paymaster);
  const submitted = params.submitted ?? {};
  return (
    identityText(submitted.name) !== verified.name ||
    identityText(submitted.entity_type) !== verified.entity_type ||
    identityText(submitted.ssm_number) !== verified.ssm_number ||
    identityText(submitted.country).toUpperCase() !== verified.country.toUpperCase()
  );
}

export function paymasterIdentityOfferBlockReason(params: {
  submitted?: {
    name?: unknown;
    entity_type?: unknown;
    ssm_number?: unknown;
    country?: unknown;
  } | null;
  paymaster?:
    | (Parameters<typeof paymasterMasterIdentityFields>[0] & {
        verificationStatus?: string | null;
        verification_status?: string | null;
      })
    | null;
}): string | null {
  if (!params.paymaster) return PAYMASTER_NOT_LINKED_MESSAGE;
  const status = params.paymaster.verificationStatus ?? params.paymaster.verification_status;
  if (!isPaymasterVerified(status)) return PAYMASTER_NOT_VERIFIED_FOR_OFFER_MESSAGE;
  if (submittedIdentityDiffersFromVerified(params)) return PAYMASTER_IDENTITY_UNRESOLVED_MESSAGE;
  return null;
}

export const VERIFIED_PAYMASTER_MUST_BE_SELECTED_CODE = "VERIFIED_PAYMASTER_MUST_BE_SELECTED";
export const VERIFIED_PAYMASTER_MUST_BE_SELECTED_MESSAGE =
  "A verified Paymaster exists for this registration number. Select it to continue.";

export const RELATED_PARTY_REQUIRED_CODE = "RELATED_PARTY_REQUIRED";
export const RELATED_PARTY_REQUIRED_MESSAGE =
  "Please confirm whether the customer is related to you.";

export const PAYMASTER_IDENTITY_IMMUTABLE_CODE = "PAYMASTER_IDENTITY_IMMUTABLE";
export const PAYMASTER_IDENTITY_IMMUTABLE_MESSAGE =
  "Verified Paymaster identity cannot be changed.";
export const PAYMASTER_EXISTING_IDENTITY_IMMUTABLE_MESSAGE =
  "Existing Paymaster identity cannot be changed.";
