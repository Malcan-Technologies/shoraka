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
      cardInstruction: "Open each document, confirm you accept it, then continue.",
      nonOwnerDescription:
        "Your organization owner must accept these documents before onboarding can continue.",
      emptyTitle: "Legal documents unavailable",
      emptyDescription:
        "Required legal documents have not been published yet. Onboarding cannot continue until an administrator publishes them. Please try again later or contact support.",
    });
    expect(legalDocumentsReviewCopy("reacceptance")).toEqual({
      title: "Updated legal documents",
      description:
        "Some legal documents have been updated. Please review and accept them before starting new transactions. Your account remains active.",
      buttonLabel: "Accept and proceed",
      cardInstruction:
        "Open each document, confirm you accept it, then continue.",
      nonOwnerDescription:
        "Your organization owner must accept these documents before new transactions can begin.",
      emptyTitle: "No updated documents",
      emptyDescription: "There are no legal documents waiting for your acceptance.",
    });
  });

  it("blocks onboarding when no published legal PDFs exist (no markdown T&C fallback)", () => {
    expect(reviewSource).toContain("LegalDocumentChecklistEmpty");
    expect(reviewSource).not.toMatch(/\bfallback\b/);
    expect(legalDocumentsReviewCopy("onboarding").emptyTitle).toBe("Legal documents unavailable");
  });

  it("centralizes type-specific checkbox wording", () => {
    expect(legalDocumentCheckboxWording("TERMS_OF_USE")).toBe(
      "I have read and agree to these terms."
    );
    expect(legalDocumentCheckboxWording("PDPA_NOTICE_AND_CONSENT")).toBe(
      "I have read the privacy notice and consent to the handling of my personal data as described."
    );
    expect(legalDocumentCheckboxWording("RISK_STATEMENT")).toBe(
      "I have read and understood the risks described in this document."
    );
    expect(legalDocumentCheckboxWording("ISSUER_WARNING_STATEMENT")).toBe(
      "I have read and understood this warning statement."
    );
    expect(legalDocumentCheckboxWording("INVESTOR_WARNING_STATEMENT")).toBe(
      "I have read and understood this warning statement."
    );
    expect(legalDocumentCheckboxWording("ISSUER_AGREEMENT")).toBe(
      "I have read and agree to this agreement."
    );
    expect(legalDocumentCheckboxWording("INVESTOR_AGREEMENT")).toBe(
      "I have read and agree to this agreement."
    );
    expect(LEGAL_DOCUMENT_CHECKBOX_WORDING.RISK_STATEMENT).toBe(
      legalDocumentCheckboxWording("RISK_STATEMENT")
    );
  });

  it("hides version numbers and simplifies review helper text", () => {
    expect(checklistSource).not.toContain("Version {");
    expect(checklistSource).toContain("Review document");
    expect(checklistSource).not.toContain("Open PDF");
    expect(legalChecklistStatusLabel("not_opened")).toBe(
      "Review the document to enable acceptance."
    );
    expect(legalChecklistStatusLabel("opened")).toBe("Ready to accept.");
    expect(legalChecklistStatusLabel("accepted")).toBe("Accepted");
  });

  it("submits exact version IDs and points re-acceptance to /legal-updates", () => {
    expect(reviewSource).toContain("/v1/legal-documents/versions/${doc.versionId}/accept");
    expect(reviewSource).toContain("/v1/legal-documents/versions/${versionId}/open");
    expect(bannerSource).toContain('href="/legal-updates"');
  });

  it("lets any organization member accept on the re-acceptance page", () => {
    expect(reviewSource).toContain('mode === "reacceptance" || isOwner');
    expect(reviewSource).toContain("copy.buttonLabel");
    expect(reviewSource).toContain("copy.cardInstruction");
  });
});
