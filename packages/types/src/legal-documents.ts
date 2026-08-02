/**
 * Onboarding / public legal document types and acceptance DTOs.
 * Reuses SiteDocument rows as versioned PDFs (DRAFT → PUBLISHED → ARCHIVED).
 */

export type LegalDocumentAudience = "PUBLIC" | "ISSUER" | "INVESTOR" | "BOTH";
export type LegalDocumentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type LegalAcceptanceAudience = "ISSUER" | "INVESTOR";
export type LegalAcceptanceStatus = "NOT_OPENED" | "OPENED" | "ACCEPTED";

/** Document types used for onboarding legal acceptance and public footer links. */
export type OnboardingLegalDocumentType =
  | "PDPA_NOTICE"
  | "TERMS_AND_CONDITIONS"
  | "RISK_STATEMENT"
  | "ISSUER_WARNING_STATEMENT"
  | "ISSUER_AGREEMENT"
  | "INVESTOR_WARNING_STATEMENT"
  | "INVESTOR_AGREEMENT";

export const ONBOARDING_LEGAL_DOCUMENT_TYPES: OnboardingLegalDocumentType[] = [
  "PDPA_NOTICE",
  "TERMS_AND_CONDITIONS",
  "RISK_STATEMENT",
  "ISSUER_WARNING_STATEMENT",
  "ISSUER_AGREEMENT",
  "INVESTOR_WARNING_STATEMENT",
  "INVESTOR_AGREEMENT",
];

export const LEGAL_DOCUMENT_TYPE_LABELS: Record<OnboardingLegalDocumentType, string> = {
  PDPA_NOTICE: "PDPA Notice and Consent",
  TERMS_AND_CONDITIONS: "Terms of Use",
  RISK_STATEMENT: "Risk Statement",
  ISSUER_WARNING_STATEMENT: "Issuer Warning Statement",
  ISSUER_AGREEMENT: "Issuer Agreement",
  INVESTOR_WARNING_STATEMENT: "Investor Warning Statement",
  INVESTOR_AGREEMENT: "Investor Agreement",
};

export const LEGAL_DOCUMENT_CHECKBOX_WORDING: Record<OnboardingLegalDocumentType, string> = {
  PDPA_NOTICE:
    "I consent to the collection, use and processing of my personal data as described in the PDPA Notice.",
  TERMS_AND_CONDITIONS: "I confirm that I have read and agree to the Terms of Use.",
  RISK_STATEMENT:
    "I confirm that I have read and understood the risks described in the Risk Statement.",
  ISSUER_WARNING_STATEMENT:
    "I acknowledge that I have read and understood the Issuer Warning Statement.",
  ISSUER_AGREEMENT: "I confirm that I have read and agree to the Issuer Agreement.",
  INVESTOR_WARNING_STATEMENT:
    "I acknowledge that I have read and understood the Investor Warning Statement.",
  INVESTOR_AGREEMENT: "I confirm that I have read and agree to the Investor Agreement.",
};

/** Default audience when admin uploads an onboarding legal PDF. */
export const LEGAL_DOCUMENT_DEFAULT_AUDIENCE: Record<
  OnboardingLegalDocumentType,
  LegalDocumentAudience
> = {
  PDPA_NOTICE: "BOTH",
  TERMS_AND_CONDITIONS: "BOTH",
  RISK_STATEMENT: "BOTH",
  ISSUER_WARNING_STATEMENT: "ISSUER",
  ISSUER_AGREEMENT: "ISSUER",
  INVESTOR_WARNING_STATEMENT: "INVESTOR",
  INVESTOR_AGREEMENT: "INVESTOR",
};

/** Shared + issuer docs for issuer onboarding. */
export const ISSUER_REQUIRED_LEGAL_TYPES: OnboardingLegalDocumentType[] = [
  "PDPA_NOTICE",
  "TERMS_AND_CONDITIONS",
  "RISK_STATEMENT",
  "ISSUER_WARNING_STATEMENT",
  "ISSUER_AGREEMENT",
];

/** Shared + investor docs for investor onboarding. */
export const INVESTOR_REQUIRED_LEGAL_TYPES: OnboardingLegalDocumentType[] = [
  "PDPA_NOTICE",
  "TERMS_AND_CONDITIONS",
  "RISK_STATEMENT",
  "INVESTOR_WARNING_STATEMENT",
  "INVESTOR_AGREEMENT",
];

export const PUBLIC_FOOTER_LEGAL_TYPES: OnboardingLegalDocumentType[] = [
  "PDPA_NOTICE",
  "TERMS_AND_CONDITIONS",
  "RISK_STATEMENT",
  "ISSUER_AGREEMENT",
  "INVESTOR_AGREEMENT",
  "ISSUER_WARNING_STATEMENT",
  "INVESTOR_WARNING_STATEMENT",
];

export function isOnboardingLegalDocumentType(
  type: string
): type is OnboardingLegalDocumentType {
  return (ONBOARDING_LEGAL_DOCUMENT_TYPES as string[]).includes(type);
}

export function getRequiredLegalTypesForAudience(
  audience: LegalAcceptanceAudience
): OnboardingLegalDocumentType[] {
  return audience === "ISSUER" ? ISSUER_REQUIRED_LEGAL_TYPES : INVESTOR_REQUIRED_LEGAL_TYPES;
}

export interface LegalDocumentVersionResponse {
  id: string;
  type: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number;
  file_hash: string | null;
  version: number;
  audience: LegalDocumentAudience;
  status: LegalDocumentStatus;
  effective_date: string | null;
  acceptance_required: boolean;
  open_before_accept_required: boolean;
  reacceptance_required: boolean;
  show_in_account: boolean;
  is_active: boolean;
  uploaded_by: string;
  published_by: string | null;
  published_at: string | null;
  archived_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequiredLegalDocumentResponse {
  id: string;
  type: OnboardingLegalDocumentType;
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
  documentId: string;
  documentVersionId: string;
  documentType: OnboardingLegalDocumentType;
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
  pendingDocuments: PendingLegalDocumentResponse[];
  blockedActions: LegalBlockedAction[];
  tncAccepted: boolean;
}

export interface PublicLegalDocumentResponse {
  id: string;
  type: OnboardingLegalDocumentType;
  title: string;
  version: number;
  file_name: string;
  published_at: string | null;
}
