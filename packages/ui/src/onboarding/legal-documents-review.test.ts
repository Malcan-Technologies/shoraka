import { LEGAL_DOCUMENT_CHECKBOX_WORDING } from "@cashsouk/types";
import { legalChecklistStatusLabel } from "./legal-document-checklist";
import {
  legalDocumentCheckboxWording,
  legalDocumentsReviewCopy,
  resolveLegalDocumentsReviewMode,
} from "./legal-documents-review-copy";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("legal documents review modes and copy", () => {
  const checklistSource = readFileSync(
    join(__dirname, "legal-document-checklist.tsx"),
    "utf8"
  );
  const reviewSource = readFileSync(join(__dirname, "legal-documents-review.tsx"), "utf8");
  const bannerSource = readFileSync(
    join(__dirname, "legal-reacceptance-banner.tsx"),
    "utf8"
  );

  it("detects onboarding vs re-acceptance from organization completion", () => {
    expect(resolveLegalDocumentsReviewMode("IN_PROGRESS")).toBe("onboarding");
    expect(resolveLegalDocumentsReviewMode("PENDING_APPROVAL")).toBe("onboarding");
    expect(resolveLegalDocumentsReviewMode("COMPLETED")).toBe("reacceptance");
  });

  it("uses mode-specific headings and buttons", () => {
    expect(legalDocumentsReviewCopy("onboarding")).toEqual({
      title: "Legal documents",
      description: "Review and accept each required document to continue onboarding.",
      buttonLabel: "Accept and Continue",
      nonOwnerDescription:
        "Your organization owner must accept these documents before onboarding can continue.",
    });
    expect(legalDocumentsReviewCopy("reacceptance")).toEqual({
      title: "Review legal documents",
      description: "Review and accept the documents below before starting new transactions.",
      buttonLabel: "Accept documents",
      nonOwnerDescription:
        "Your organization owner must accept these documents before new transactions can begin.",
    });
  });

  it("centralizes type-specific checkbox wording", () => {
    expect(legalDocumentCheckboxWording("TERMS_OF_USE")).toBe(
      "I have read and agree to the Terms of Use."
    );
    expect(legalDocumentCheckboxWording("PDPA_NOTICE_AND_CONSENT")).toBe(
      "I have read the PDPA Notice and consent to the handling of my personal data as described."
    );
    expect(legalDocumentCheckboxWording("RISK_STATEMENT")).toBe(
      "I have read and understood the Risk Statement."
    );
    expect(legalDocumentCheckboxWording("ISSUER_WARNING_STATEMENT")).toBe(
      "I have read and understood the Issuer Warning Statement."
    );
    expect(legalDocumentCheckboxWording("INVESTOR_WARNING_STATEMENT")).toBe(
      "I have read and understood the Investor Warning Statement."
    );
    expect(legalDocumentCheckboxWording("ISSUER_AGREEMENT")).toBe(
      "I have read and agree to the Issuer Agreement."
    );
    expect(legalDocumentCheckboxWording("INVESTOR_AGREEMENT")).toBe(
      "I have read and agree to the Investor Agreement."
    );
    expect(LEGAL_DOCUMENT_CHECKBOX_WORDING.RISK_STATEMENT).toBe(
      legalDocumentCheckboxWording("RISK_STATEMENT")
    );
  });

  it("hides version numbers and simplifies open helper text", () => {
    expect(checklistSource).not.toContain("Version {");
    expect(checklistSource).toContain("Open PDF");
    expect(legalChecklistStatusLabel("not_opened")).toBe(
      "Open this document before accepting."
    );
    expect(legalChecklistStatusLabel("opened")).toBeNull();
    expect(legalChecklistStatusLabel("accepted")).toBe("Accepted");
  });

  it("submits exact version IDs and points re-acceptance to /onboarding/terms", () => {
    expect(reviewSource).toContain("/v1/legal-documents/versions/${doc.versionId}/accept");
    expect(reviewSource).toContain("/v1/legal-documents/versions/${versionId}/open");
    expect(bannerSource).toContain('href="/onboarding/terms"');
  });
});
