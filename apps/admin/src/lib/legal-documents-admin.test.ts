import type { LegalDocumentDefinitionResponse } from "@cashsouk/types";
import { LEGAL_DOCUMENT_TYPE_LABELS } from "@cashsouk/types";
import {
  audienceLabel,
  buildCreateDefinitionPayload,
  buildEditDefinitionPayload,
  buildPublishDialogTitle,
  documentCurrentStatus,
  formatLegalDate,
  getLegalDocumentRowActions,
  hasLegalVersionHistory,
  latestDraftVersion,
  legalDocumentDisplayName,
  legalStatusBadgeVariant,
  matchesClientFilters,
  nextCreateOrchestrationAfterDefinition,
  nextCreateOrchestrationAfterVersion,
  onboardingBadgeLabel,
  onboardingBadgeVariant,
  OPERATIONAL_AUDIENCES,
  resetCreateOrchestration,
  shouldSkipDefinitionCreate,
  shouldSkipVersionUpload,
  statusLabel,
  validateLegalPdfFile,
  websiteBadgeVariant,
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
    expect(audienceLabel("ISSUER")).toBe("Issuer");
    expect(audienceLabel("INVESTOR")).toBe("Investor");
    expect(audienceLabel("PUBLIC")).toBe("Public");
    expect(websiteVisibilityLabel(true)).toBe("Public");
    expect(websiteVisibilityLabel(false)).toBe("Private");
    expect(OPERATIONAL_AUDIENCES).not.toContain("PUBLIC");
    expect(statusLabel("DRAFT")).toBe("Draft");
  });

  it("maps type enums to human labels and formats full date-time", () => {
    expect(LEGAL_DOCUMENT_TYPE_LABELS.PDPA_NOTICE_AND_CONSENT).toBe(
      "PDPA Notice and Consent"
    );
    expect(LEGAL_DOCUMENT_TYPE_LABELS.TERMS_OF_USE).toBe("Terms of Use");
    const formatted = formatLegalDate("2026-07-29T01:44:00.000Z");
    expect(formatted).toMatch(/29/);
    expect(formatted).toMatch(/Jul/);
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });

  it("uses semantic badge variants for status, onboarding, and website", () => {
    expect(legalStatusBadgeVariant("PUBLISHED")).toBe("success");
    expect(legalStatusBadgeVariant("DRAFT")).toBe("secondary");
    expect(legalStatusBadgeVariant("ARCHIVED")).toBe("muted");
    expect(onboardingBadgeVariant(true)).toBe("warning");
    expect(onboardingBadgeVariant(false)).toBe("secondary");
    expect(onboardingBadgeLabel(true)).toBe("Required");
    expect(websiteBadgeVariant(true)).toBe("info");
    expect(websiteBadgeVariant(false)).toBe("secondary");
  });

  it("builds create and edit payloads from type label without free-text title", () => {
    expect(legalDocumentDisplayName("PDPA_NOTICE_AND_CONSENT")).toBe(
      "PDPA Notice and Consent"
    );
    expect(
      buildCreateDefinitionPayload({
        type: "PDPA_NOTICE_AND_CONSENT",
        audience: "BOTH",
        requiredForOnboarding: true,
        publicVisibility: true,
      })
    ).toEqual({
      type: "PDPA_NOTICE_AND_CONSENT",
      title: "PDPA Notice and Consent",
      audience: "BOTH",
      requiredForOnboarding: true,
      publicVisibility: true,
    });
    expect(
      buildEditDefinitionPayload({
        type: "TERMS_OF_USE",
        audience: "ISSUER",
        requiredForOnboarding: false,
        publicVisibility: false,
      })
    ).toEqual({
      title: "Terms of Use",
      description: null,
      audience: "ISSUER",
      requiredForOnboarding: false,
      publicVisibility: false,
    });
  });

  it("builds publish dialog titles from type label and version", () => {
    expect(buildPublishDialogTitle("PDPA_NOTICE_AND_CONSENT", 1)).toBe(
      "Publish PDPA Notice and Consent v1?"
    );
    expect(buildPublishDialogTitle("TERMS_OF_USE", 2)).toBe("Publish Terms of Use v2?");
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

    const afterVersion = nextCreateOrchestrationAfterVersion(
      nextCreateOrchestrationAfterDefinition({ id: "ld-1", title: "PDPA" }),
      "ver-1"
    );
    expect(shouldSkipVersionUpload(afterVersion)).toBe(true);
    expect(shouldSkipVersionUpload(resetCreateOrchestration())).toBe(false);
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

  it("maps badge variants and row actions by status", () => {
    expect(legalStatusBadgeVariant("PUBLISHED")).toBe("success");
    expect(legalStatusBadgeVariant("DRAFT")).toBe("secondary");
    expect(legalStatusBadgeVariant("ARCHIVED")).toBe("muted");
    expect(onboardingBadgeVariant(true)).toBe("warning");
    expect(onboardingBadgeLabel(true)).toBe("Required");
    expect(onboardingBadgeLabel(false)).toBe("Optional");
    expect(websiteBadgeVariant(true)).toBe("info");
    expect(websiteVisibilityLabel(true)).toBe("Public");

    const draftActions = getLegalDocumentRowActions("DRAFT", {
      hasCurrentVersion: true,
      hasDraft: true,
    });
    expect(draftActions.showPublishButton).toBe(true);
    expect(draftActions.icons).toEqual(["view", "edit", "replaceDraft", "archive"]);
    expect(draftActions.icons).not.toContain("uploadNew");

    const publishedActions = getLegalDocumentRowActions("PUBLISHED", {
      hasCurrentVersion: true,
      hasDraft: false,
    });
    expect(publishedActions.showPublishButton).toBe(false);
    expect(publishedActions.icons).toEqual([
      "view",
      "download",
      "edit",
      "uploadNew",
      "archive",
    ]);
    expect(publishedActions.icons).not.toContain("replaceDraft");

    const archivedActions = getLegalDocumentRowActions("ARCHIVED", {
      hasCurrentVersion: true,
      hasDraft: false,
    });
    expect(archivedActions.showPublishButton).toBe(false);
    expect(archivedActions.icons).toEqual(["view"]);
  });

  it("shows version history only when more than one version exists", () => {
    expect(
      hasLegalVersionHistory(
        baseDoc({
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
        })
      )
    ).toBe(false);
    expect(
      hasLegalVersionHistory(
        baseDoc({
          id: "1",
          type: "PDPA_NOTICE_AND_CONSENT",
          title: "PDPA",
          versions: [
            {
              id: "v1",
              version: 1,
              status: "ARCHIVED",
              fileName: "a.pdf",
              fileSize: 1,
              fileHash: null,
              reacceptanceRequired: false,
              uploadedBy: "u",
              publishedBy: "u",
              publishedAt: "2026-08-01T00:00:00.000Z",
              archivedBy: "u",
              archivedAt: "2026-08-02T00:00:00.000Z",
              createdAt: "2026-08-01T00:00:00.000Z",
              updatedAt: "2026-08-02T00:00:00.000Z",
            },
            {
              id: "v2",
              version: 2,
              status: "PUBLISHED",
              fileName: "b.pdf",
              fileSize: 1,
              fileHash: null,
              reacceptanceRequired: false,
              uploadedBy: "u",
              publishedBy: "u",
              publishedAt: "2026-08-02T00:00:00.000Z",
              archivedBy: null,
              archivedAt: null,
              createdAt: "2026-08-02T00:00:00.000Z",
              updatedAt: "2026-08-02T00:00:00.000Z",
            },
          ],
        })
      )
    ).toBe(true);
  });
});
