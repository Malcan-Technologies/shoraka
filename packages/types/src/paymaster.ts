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

export interface PaymasterIdentity {
  id: string;
  legalName: string;
  registrationNumber: string;
  registrationCountry: string;
  entityType: string;
  mismatchPending: boolean;
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
  isRelatedParty: boolean | null;
  lastUsedAt: string;
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
