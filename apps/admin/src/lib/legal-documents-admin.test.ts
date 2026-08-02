import type { LegalDocumentDefinitionResponse } from "@cashsouk/types";
import {
  audienceLabel,
  buildCreateDefinitionPayload,
  buildPublishDialogTitle,
  documentCurrentStatus,
  latestDraftVersion,
  matchesClientFilters,
  nextCreateOrchestrationAfterDefinition,
  OPERATIONAL_AUDIENCES,
  resetCreateOrchestration,
  shouldSkipDefinitionCreate,
  statusLabel,
  validateLegalPdfFile,
  websiteVisibilityLabel,
} from "./legal-documents-admin";

describe("legal-documents-admin helpers", () => {
  const baseDoc = (
    partial: Partial<LegalDocumentDefinitionResponse> &
      Pick<LegalDocumentDefinitionResponse, "id" | "title" | "type">
  ): LegalDocumentDefinitionResponse => ({
    id: partial.id,
    type: partial.type,
    title: partial.title,
    description: partial.description ?? null,
    audience: partial.audience ?? "BOTH",
    requiredForOnboarding: partial.requiredForOnboarding ?? true,
    publicVisibility: partial.publicVisibility ?? false,
    createdAt: partial.createdAt ?? "2026-08-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-08-01T00:00:00.000Z",
    versions: partial.versions,
  });

  it("separates who-must-accept labels from website visibility", () => {
    expect(audienceLabel("BOTH")).toBe("Issuer & Investor");
    expect(audienceLabel("ISSUER")).toBe("Issuer only");
    expect(audienceLabel("INVESTOR")).toBe("Investor only");
    expect(audienceLabel("PUBLIC")).toBe("No portal acceptance");
    expect(websiteVisibilityLabel(true)).toBe("On website");
    expect(websiteVisibilityLabel(false)).toBe("Hidden");
    expect(OPERATIONAL_AUDIENCES).not.toContain("PUBLIC");
    expect(statusLabel("DRAFT")).toBe("Draft");
  });

  it("builds create payload with onboarding and website toggles", () => {
    expect(
      buildCreateDefinitionPayload({
        type: "PDPA_NOTICE_AND_CONSENT",
        title: "  PDPA Notice  ",
        description: "  Privacy notice  ",
        audience: "BOTH",
        requiredForOnboarding: true,
        publicVisibility: true,
      })
    ).toEqual({
      type: "PDPA_NOTICE_AND_CONSENT",
      title: "PDPA Notice",
      description: "Privacy notice",
      audience: "BOTH",
      requiredForOnboarding: true,
      publicVisibility: true,
    });
  });

  it("builds publish dialog titles with document title and version", () => {
    expect(buildPublishDialogTitle("PDPA Notice and Consent", "PDPA", 1)).toBe(
      "Publish PDPA Notice and Consent v1?"
    );
    expect(buildPublishDialogTitle("  ", "Terms of Use", 2)).toBe("Publish Terms of Use v2?");
  });

  it("rejects non-PDF and oversized files", () => {
    expect(validateLegalPdfFile(null).ok).toBe(false);
    expect(
      validateLegalPdfFile(new File(["x"], "notes.txt", { type: "text/plain" })).ok
    ).toBe(false);
    expect(
      validateLegalPdfFile(
        new File(["%PDF"], "ok.pdf", { type: "application/pdf" })
      ).ok
    ).toBe(true);
  });

  it("derives draft status and avoids duplicate create after partial failure", () => {
    const draft = baseDoc({
      id: "1",
      type: "TERMS_OF_USE",
      title: "Terms",
      versions: [
        {
          id: "v1",
          version: 1,
          status: "DRAFT",
          fileName: "a.pdf",
          fileSize: 1,
          fileHash: null,
          reacceptanceRequired: false,
          uploadedBy: "u",
          publishedBy: null,
          publishedAt: null,
          archivedBy: null,
          archivedAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });
    expect(documentCurrentStatus(draft)).toBe("DRAFT");
    expect(latestDraftVersion(draft)?.id).toBe("v1");
    expect(
      shouldSkipDefinitionCreate(
        nextCreateOrchestrationAfterDefinition({ id: "ld-1", title: "PDPA" })
      )
    ).toBe(true);
    expect(shouldSkipDefinitionCreate(resetCreateOrchestration())).toBe(false);
  });

  it("filters by status", () => {
    const doc = baseDoc({
      id: "1",
      type: "PDPA_NOTICE_AND_CONSENT",
      title: "PDPA",
      versions: [
        {
          id: "v1",
          version: 1,
          status: "PUBLISHED",
          fileName: "a.pdf",
          fileSize: 1,
          fileHash: null,
          reacceptanceRequired: false,
          uploadedBy: "u",
          publishedBy: "u",
          publishedAt: "2026-08-01T00:00:00.000Z",
          archivedBy: null,
          archivedAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });
    expect(
      matchesClientFilters(doc, {
        audience: "all",
        status: "PUBLISHED",
        publicVisibility: "all",
        onboarding: "all",
      })
    ).toBe(true);
  });
});
