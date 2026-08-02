import type { LegalDocumentType } from "@cashsouk/types";
import { LEGAL_DOCUMENT_CHECKBOX_WORDING, LEGAL_DOCUMENT_TYPE_LABELS } from "@cashsouk/types";

export type LegalDocumentsReviewMode = "onboarding" | "reacceptance";

export function resolveLegalDocumentsReviewMode(
  onboardingStatus: string | null | undefined
): LegalDocumentsReviewMode {
  return onboardingStatus === "COMPLETED" ? "reacceptance" : "onboarding";
}

export function legalDocumentsReviewCopy(mode: LegalDocumentsReviewMode): {
  title: string;
  description: string;
  buttonLabel: string;
  nonOwnerDescription: string;
} {
  if (mode === "reacceptance") {
    return {
      title: "Updated legal documents",
      description:
        "Some legal documents have been updated. Please review and accept them before starting new transactions. Your account remains active.",
      buttonLabel: "Accept updated documents",
      nonOwnerDescription:
        "Your organization owner must accept these documents before new transactions can begin.",
    };
  }

  return {
    title: "Legal documents",
    description: "Review and accept each required document to continue onboarding.",
    buttonLabel: "Accept and Continue",
    nonOwnerDescription:
      "Your organization owner must accept these documents before onboarding can continue.",
  };
}

/** Single source for acceptance checkbox copy (UI + API responses should match). */
export function legalDocumentCheckboxWording(type: LegalDocumentType): string {
  return LEGAL_DOCUMENT_CHECKBOX_WORDING[type];
}

export function legalDocumentDisplayTitle(type: LegalDocumentType, fallbackTitle?: string): string {
  return fallbackTitle?.trim() || LEGAL_DOCUMENT_TYPE_LABELS[type];
}
