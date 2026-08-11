/**
 * Legal document types and acceptance DTOs (LegalDocument / LegalDocumentVersion).
 */

export type LegalDocumentAudience = "PUBLIC" | "ISSUER" | "INVESTOR" | "BOTH";
export type LegalDocumentVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type LegalAcceptanceAudience = "ISSUER" | "INVESTOR";
export type LegalAcceptanceStatus = "NOT_OPENED" | "OPENED" | "ACCEPTED";

/** @deprecated Use LegalDocumentVersionStatus */
export type LegalDocumentStatus = LegalDocumentVersionStatus;

export type LegalDocumentType =
  | "PDPA_NOTICE_AND_CONSENT"
  | "TERMS_OF_USE"
  | "RISK_STATEMENT"
  | "ISSUER_WARNING_STATEMENT"
  | "INVESTOR_WARNING_STATEMENT"
  | "ISSUER_AGREEMENT"
  | "INVESTOR_AGREEMENT";

/** @deprecated Use LegalDocumentType */
export type OnboardingLegalDocumentType = LegalDocumentType;

export const LEGAL_DOCUMENT_TYPES: LegalDocumentType[] = [
  "PDPA_NOTICE_AND_CONSENT",
  "TERMS_OF_USE",
  "RISK_STATEMENT",
  "ISSUER_WARNING_STATEMENT",
  "INVESTOR_WARNING_STATEMENT",
  "ISSUER_AGREEMENT",
  "INVESTOR_AGREEMENT",
];

/** @deprecated Use LEGAL_DOCUMENT_TYPES */
export const ONBOARDING_LEGAL_DOCUMENT_TYPES = LEGAL_DOCUMENT_TYPES;

export const LEGAL_DOCUMENT_TYPE_LABELS: Record<LegalDocumentType, string> = {
  PDPA_NOTICE_AND_CONSENT: "PDPA Notice and Consent",
  TERMS_OF_USE: "Terms of Use",
  RISK_STATEMENT: "Risk Statement",
  ISSUER_WARNING_STATEMENT: "Issuer Warning Statement",
  INVESTOR_WARNING_STATEMENT: "Investor Warning Statement",
  ISSUER_AGREEMENT: "Issuer Agreement",
  INVESTOR_AGREEMENT: "Investor Agreement",
};

export const LEGAL_DOCUMENT_CHECKBOX_WORDING: Record<LegalDocumentType, string> = {
  PDPA_NOTICE_AND_CONSENT:
    "I have read the privacy notice and consent to the handling of my personal data as described.",
  TERMS_OF_USE: "I have read and agree to these terms.",
  RISK_STATEMENT:
    "I have read and understood the risks described in this document.",
  ISSUER_WARNING_STATEMENT: "I have read and understood this warning statement.",
  INVESTOR_WARNING_STATEMENT: "I have read and understood this warning statement.",
  ISSUER_AGREEMENT: "I have read and agree to this agreement.",
  INVESTOR_AGREEMENT: "I have read and agree to this agreement.",
};

/** Default audience when admin creates a legal document definition. */
export const LEGAL_DOCUMENT_DEFAULT_AUDIENCE: Record<LegalDocumentType, LegalDocumentAudience> = {
  PDPA_NOTICE_AND_CONSENT: "BOTH",
  TERMS_OF_USE: "BOTH",
  RISK_STATEMENT: "BOTH",
  ISSUER_WARNING_STATEMENT: "ISSUER",
  ISSUER_AGREEMENT: "ISSUER",
  INVESTOR_WARNING_STATEMENT: "INVESTOR",
  INVESTOR_AGREEMENT: "INVESTOR",
};

/** Shared + issuer docs for issuer onboarding. */
export const ISSUER_REQUIRED_LEGAL_TYPES: LegalDocumentType[] = [
  "PDPA_NOTICE_AND_CONSENT",
  "TERMS_OF_USE",
  "RISK_STATEMENT",
  "ISSUER_WARNING_STATEMENT",
  "ISSUER_AGREEMENT",
];

/** Shared + investor docs for investor onboarding. */
export const INVESTOR_REQUIRED_LEGAL_TYPES: LegalDocumentType[] = [
  "PDPA_NOTICE_AND_CONSENT",
  "TERMS_OF_USE",
  "RISK_STATEMENT",
  "INVESTOR_WARNING_STATEMENT",
  "INVESTOR_AGREEMENT",
];

export const PUBLIC_FOOTER_LEGAL_TYPES: LegalDocumentType[] = [
  "TERMS_OF_USE",
  "PDPA_NOTICE_AND_CONSENT",
  "RISK_STATEMENT",
  "ISSUER_WARNING_STATEMENT",
  "ISSUER_AGREEMENT",
  "INVESTOR_WARNING_STATEMENT",
  "INVESTOR_AGREEMENT",
];

/** Stable slug for each legal document type (API / admin compatibility). */
export const LEGAL_DOCUMENT_TYPE_SLUGS: Record<LegalDocumentType, string> = {
  TERMS_OF_USE: "terms-of-use",
  PDPA_NOTICE_AND_CONSENT: "pdpa-notice-and-consent",
  RISK_STATEMENT: "risk-statement",
  ISSUER_WARNING_STATEMENT: "issuer-warning-statement",
  ISSUER_AGREEMENT: "issuer-agreement",
  INVESTOR_WARNING_STATEMENT: "investor-warning-statement",
  INVESTOR_AGREEMENT: "investor-agreement",
};

export const LEGAL_DOCUMENT_PUBLIC_GROUPS = {
  general: ["TERMS_OF_USE", "PDPA_NOTICE_AND_CONSENT", "RISK_STATEMENT"] as const,
  issuer: ["ISSUER_WARNING_STATEMENT", "ISSUER_AGREEMENT"] as const,
  investor: ["INVESTOR_WARNING_STATEMENT", "INVESTOR_AGREEMENT"] as const,
};

export function legalDocumentTypeToSlug(type: LegalDocumentType): string {
  return LEGAL_DOCUMENT_TYPE_SLUGS[type];
}

export function legalDocumentSlugToType(slug: string): LegalDocumentType | null {
  const entry = (Object.entries(LEGAL_DOCUMENT_TYPE_SLUGS) as [LegalDocumentType, string][]).find(
    ([, value]) => value === slug
  );
  return entry?.[0] ?? null;
}

export function isLegalDocumentType(type: string): type is LegalDocumentType {
  return (LEGAL_DOCUMENT_TYPES as string[]).includes(type);
}

/** @deprecated Use isLegalDocumentType */
export function isOnboardingLegalDocumentType(type: string): type is LegalDocumentType {
  return isLegalDocumentType(type);
}

export function getRequiredLegalTypesForAudience(
  audience: LegalAcceptanceAudience
): LegalDocumentType[] {
  return audience === "ISSUER" ? ISSUER_REQUIRED_LEGAL_TYPES : INVESTOR_REQUIRED_LEGAL_TYPES;
}

export interface LegalDocumentDefinitionResponse {
  id: string;
  type: LegalDocumentType;
  title: string;
  description: string | null;
  audience: LegalDocumentAudience;
  requiredForOnboarding: boolean;
  publicVisibility: boolean;
  showInAccount: boolean;
  createdAt: string;
  updatedAt: string;
  versions?: LegalDocumentVersionSummary[];
}

export interface LegalDocumentVersionSummary {
  id: string;
  version: number;
  status: LegalDocumentVersionStatus;
  fileName: string;
  fileSize: number;
  fileHash: string | null;
  reacceptanceRequired: boolean;
  uploadedBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  archivedBy: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegalDocumentVersionResponse extends LegalDocumentVersionSummary {
  legalDocumentId: string;
  s3Key: string;
  contentType: string;
  type: LegalDocumentType;
  title: string;
  description: string | null;
  audience: LegalDocumentAudience;
  requiredForOnboarding: boolean;
  publicVisibility: boolean;
  showInAccount: boolean;
}

/** Published legal document shown on Profile → Documents (show_in_account). */
export interface AccountLegalDocumentResponse {
  legalDocumentId: string;
  legalDocumentVersionId: string;
  type: LegalDocumentType;
  title: string;
  version: number;
  file_name: string;
  file_size: number;
  content_type: string;
}

export type LegalAcceptanceEventStatus = LegalAcceptanceStatus;

export interface LegalDocumentAcceptanceListItem {
  id: string;
  acceptedAt: string | null;
  openedAt: string | null;
  createdAt: string;
  status: LegalAcceptanceStatus;
  documentType: LegalDocumentType | null;
  documentTitle: string;
  versionNumber: number | null;
  legalDocumentVersionId: string;
  legalDocumentId: string | null;
  fileName: string | null;
  documentHash: string | null;
  organizationId: string | null;
  organizationName: string | null;
  organizationAccountType: string | null;
  portal: LegalAcceptanceAudience;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  openedIpAddress: string | null;
  openedUserAgent: string | null;
  openedDeviceInfo: string | null;
  acceptedIpAddress: string | null;
  acceptedUserAgent: string | null;
  acceptedDeviceInfo: string | null;
  acknowledgementText: string | null;
}

export interface LegalDocumentAcceptanceDetail extends LegalDocumentAcceptanceListItem {
  versionStatus: LegalDocumentVersionStatus | null;
  contentType: string | null;
  fileSize: number | null;
}

export type LegalDocumentAuditAction =
  | "LEGAL_DOCUMENT_CREATED"
  | "LEGAL_DOCUMENT_UPDATED"
  | "LEGAL_VERSION_UPLOADED"
  | "LEGAL_VERSION_FILE_REPLACED"
  | "LEGAL_VERSION_PUBLISHED"
  | "LEGAL_VERSION_ARCHIVED"
  | "LEGAL_VERSION_RESTORED";

export interface LegalDocumentAuditLogListItem {
  id: string;
  action: LegalDocumentAuditAction;
  legalDocumentId: string | null;
  legalDocumentVersionId: string | null;
  documentType: LegalDocumentType | null;
  versionNumber: number | null;
  documentHash: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  createdAt: string;
}

export interface RequiredLegalDocumentResponse {
  legalDocumentId: string;
  legalDocumentVersionId: string;
  type: LegalDocumentType;
  title: string;
  version: number;
  file_name: string;
  file_hash: string | null;
  open_before_accept_required: boolean;
  acceptance_required: boolean;
  checkbox_wording: string;
  acceptance_status: LegalAcceptanceStatus;
  opened_at: string | null;
  accepted_at: string | null;
}

export interface LegalAcceptanceStatusResponse {
  audience: LegalAcceptanceAudience;
  organization_id: string;
  all_accepted: boolean;
  documents: RequiredLegalDocumentResponse[];
}

export interface PendingLegalDocumentResponse {
  legalDocumentId: string;
  legalDocumentVersionId: string;
  documentType: LegalDocumentType;
  title: string;
  version: number;
  file_name: string;
  file_hash: string | null;
  open_before_accept_required: boolean;
  checkbox_wording: string;
  acceptance_status: LegalAcceptanceStatus;
  openedAt: string | null;
  acceptedAt: string | null;
}

export type LegalBlockedAction =
  | "NEW_FINANCING_APPLICATION"
  | "NEW_UTILISATION"
  | "NEW_INVESTMENT";

export interface LegalComplianceStatus {
  onboardingComplete: boolean;
  hasPendingReacceptance: boolean;
  isOrganisationOwner: boolean;
  pendingDocuments: PendingLegalDocumentResponse[];
  blockedActions: LegalBlockedAction[];
  tncAccepted: boolean;
}

export interface PublicLegalDocumentResponse {
  legalDocumentId: string;
  legalDocumentVersionId: string;
  type: LegalDocumentType;
  slug: string;
  title: string;
  description: string | null;
  audience: LegalDocumentAudience;
  version: number;
  file_name: string;
  published_at: string | null;
}
