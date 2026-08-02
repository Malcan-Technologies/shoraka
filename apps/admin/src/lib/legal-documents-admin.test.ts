import type { LegalDocumentDefinitionResponse } from "@cashsouk/types";
import {
  audienceLabel,
  buildCreateDefinitionPayload,
  buildPublishDialogTitle,
  documentCurrentStatus,
  latestDraftVersion,
  matchesClientFilters,
  nextCreateOrchestrationAfterDefinition,
  resetCreateOrchestration,
  shouldSkipDefinitionCreate,
  statusLabel,
  validateLegalPdfFile,
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

  it("maps audience and status to human-readable labels", () => {
    expect(audienceLabel("BOTH")).toBe("Issuer & Investor");
    expect(audienceLabel("ISSUER")).toBe("Issuer");
    expect(audienceLabel("INVESTOR")).toBe("Investor");
    expect(audienceLabel("PUBLIC")).toBe("Public");
    expect(statusLabel("DRAFT")).toBe("Draft");
    expect(statusLabel("PUBLISHED")).toBe("Published");
    expect(statusLabel("ARCHIVED")).toBe("Archived");
  });

  it("builds create payload with onboarding and public toggles", () => {
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

    expect(
      buildCreateDefinitionPayload({
        type: "TERMS_OF_USE",
        title: "Terms",
        description: "   ",
        audience: "ISSUER",
        requiredForOnboarding: false,
        publicVisibility: false,
      }).description
    ).toBeUndefined();
  });

  it("rejects non-PDF and oversized files", () => {
    expect(validateLegalPdfFile(null).ok).toBe(false);
    expect(
      validateLegalPdfFile(
        new File(["x"], "notes.txt", { type: "text/plain" })
      ).ok
    ).toBe(false);
    expect(
      validateLegalPdfFile(
        new File([new Uint8Array(11 * 1024 * 1024)], "big.pdf", {
          type: "application/pdf",
        })
      ).ok
    ).toBe(false);
    expect(
      validateLegalPdfFile(
        new File(["%PDF"], "ok.pdf", { type: "application/pdf" })
      ).ok
    ).toBe(true);
  });

  it("derives draft / published / archived row status", () => {
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

    const published = baseDoc({
      id: "2",
      type: "TERMS_OF_USE",
      title: "Terms",
      versions: [
        {
          id: "v2",
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
    expect(documentCurrentStatus(published)).toBe("PUBLISHED");

    const archived = baseDoc({
      id: "3",
      type: "TERMS_OF_USE",
      title: "Terms",
      versions: [
        {
          id: "v3",
          version: 1,
          status: "ARCHIVED",
          fileName: "a.pdf",
          fileSize: 1,
          fileHash: null,
          reacceptanceRequired: false,
          uploadedBy: "u",
          publishedBy: null,
          publishedAt: null,
          archivedBy: "u",
          archivedAt: "2026-08-01T00:00:00.000Z",
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });
    expect(documentCurrentStatus(archived)).toBe("ARCHIVED");
  });

  it("builds publish dialog titles with document title and version", () => {
    expect(buildPublishDialogTitle("PDPA Notice and Consent", "PDPA", 1)).toBe(
      "Publish PDPA Notice and Consent v1?"
    );
    expect(buildPublishDialogTitle("  ", "Terms of Use", 2)).toBe("Publish Terms of Use v2?");
    expect(buildPublishDialogTitle(null, null, 1)).toBe("Publish document v1?");
  });

  it("avoids duplicate definition create after partial upload failure", () => {
    const afterCreate = nextCreateOrchestrationAfterDefinition({
      id: "ld-1",
      title: "PDPA",
    });
    expect(shouldSkipDefinitionCreate(afterCreate)).toBe(true);
    expect(shouldSkipDefinitionCreate(resetCreateOrchestration())).toBe(false);
  });

  it("filters by audience, public, onboarding, and status", () => {
    const doc = baseDoc({
      id: "1",
      type: "PDPA_NOTICE_AND_CONSENT",
      title: "PDPA",
      audience: "BOTH",
      publicVisibility: true,
      requiredForOnboarding: true,
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
        audience: "BOTH",
        status: "PUBLISHED",
        publicVisibility: "yes",
        onboarding: "required",
      })
    ).toBe(true);
    expect(
      matchesClientFilters(doc, {
        audience: "ISSUER",
        status: "all",
        publicVisibility: "all",
        onboarding: "all",
      })
    ).toBe(false);
  });
});
