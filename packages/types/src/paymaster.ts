export const PAYMASTER_ASSIGNMENT_NOTICE_STATUSES = [
  "GENERATED",
  "SENT",
  "ACKNOWLEDGEMENT_UPLOADED",
  "ACKNOWLEDGED",
  "FAILED",
] as const;

export type PaymasterAssignmentNoticeStatus =
  (typeof PAYMASTER_ASSIGNMENT_NOTICE_STATUSES)[number];

export const PAYMASTER_MISMATCH_STATUSES = ["PENDING", "RESOLVED"] as const;
export type PaymasterMismatchStatus = (typeof PAYMASTER_MISMATCH_STATUSES)[number];

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
  mismatchPending: boolean;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymasterListItem extends PaymasterIdentity {
  linkedIssuerCount: number;
  linkedNoteCount: number;
  lastUsedAt: string | null;
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

export interface PaymasterMismatchRow {
  id: string;
  status: PaymasterMismatchStatus;
  submittedLegalName: string;
  submittedEntityType: string;
  submittedCountry: string;
  existingLegalName: string;
  existingEntityType: string;
  existingCountry: string;
  applicationId: string | null;
  contractId: string | null;
  createdAt: string;
  resolvedAt: string | null;
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
  mismatches: PaymasterMismatchRow[];
  notices: PaymasterNoticeHistoryRow[];
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

export const ASSIGNMENT_NOTICE_LEGAL_TEMPLATE_PENDING =
  "Approved Notice of Assignment legal wording is pending. This file records assignment particulars only and is not a substitute for the approved legal template.";

export const PAYMASTER_NOT_VERIFIED_CODE = "PAYMASTER_NOT_VERIFIED";
export const PAYMASTER_NOT_VERIFIED_MESSAGE =
  "You can only select a verified Paymaster for reuse.";

export const VERIFIED_PAYMASTER_MUST_BE_SELECTED_CODE = "VERIFIED_PAYMASTER_MUST_BE_SELECTED";
export const VERIFIED_PAYMASTER_MUST_BE_SELECTED_MESSAGE =
  "A verified Paymaster exists for this registration number. Select it to continue.";

export const RELATED_PARTY_REQUIRED_CODE = "RELATED_PARTY_REQUIRED";
export const RELATED_PARTY_REQUIRED_MESSAGE =
  "Please confirm whether the customer is related to you.";
