import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin Legal Documents page UX", () => {
  const source = readFileSync(
    join(__dirname, "../app/legal-documents/page.tsx"),
    "utf8"
  );
  const helpers = readFileSync(
    join(__dirname, "legal-documents-admin.ts"),
    "utf8"
  );

  it("create modal uses Audience without Access heading", () => {
    expect(source).toContain("Add Legal Document");
    expect(source).toContain("Save as Draft");
    expect(source).toContain('id="legal-pdf"');
    expect(source).toContain('id="legal-audience"');
    expect(source).toContain("Choose who this document applies to.");
    expect(source).toContain("Audience and visibility");
    expect(source).not.toContain(">Access</h3>");
    expect(source).not.toContain("Applies to");
    expect(source).not.toContain("Publish Now");
    expect(source).not.toContain('id="legal-title"');
  });

  it("table columns omit Type and use Audience with icon actions", () => {
    expect(source).toContain(">Document</TableHead>");
    expect(source).toContain(">Version</TableHead>");
    expect(source).toContain(">Status</TableHead>");
    expect(source).toContain(">Audience</TableHead>");
    expect(source).toContain(">Onboarding</TableHead>");
    expect(source).toContain(">Website</TableHead>");
    expect(source).toContain(">Re-accept</TableHead>");
    expect(source).toContain(">Updated</TableHead>");
    expect(source).toContain(">Actions</TableHead>");
    expect(source).not.toContain(">Type</TableHead>");
    expect(source).toContain("reacceptanceBadgeLabel");
    expect(source).toContain("reacceptanceBadgeVariant");
    expect(source).toContain("legalDocumentDisplayName(doc.type)");
    expect(source).toContain("current?.fileName");
    expect(source).toContain("ArrowDownTrayIcon");
    expect(source).toContain("PencilSquareIcon");
    expect(source).toContain("ArrowUpTrayIcon");
    expect(source).toContain("ArchiveBoxIcon");
    expect(source).toContain("ArrowUturnLeftIcon");
    expect(source).toContain("DocumentDuplicateIcon");
    expect(source).toContain("handleRestoreVersion");
    expect(source).toContain("handleCreateVersionFromArchived");
    expect(source).toContain("canRestoreArchivedVersion");
    expect(source).toContain("canCreateVersionFromArchivedPublished");
    expect(source).toContain("CheckCircleIcon");
    expect(source).toContain(': "Publish"');
    expect(source).toContain("handleDownload");
    expect(source).toContain("hasLegalVersionHistory");
    expect(source).toContain('title="Version history"');
    expect(source).not.toContain("EllipsisHorizontalIcon");
    expect(source).not.toContain("EyeIcon");
    expect(helpers).toContain('hour: "2-digit"');
  });

  it("uses semantic badges and status-based compact actions", () => {
    expect(source).toContain("legalStatusToken");
    expect(source).toContain("onboardingBadgeVariant");
    expect(source).toContain("websiteBadgeVariant");
    expect(source).toContain("getLegalDocumentRowActions");
    expect(source).toContain("actions.showPublishButton");
    expect(source).toContain("Replace draft PDF");
    expect(source).toContain("Upload new version");
  });

  it("replaces draft PDF in place and archives with no-fallback warning", () => {
    expect(source).toContain("replaceDraftPdfInPlace");
    expect(source).toContain("Version number unchanged");
    expect(source).toContain("The version number stays the same");
    expect(source).not.toContain("The current draft will be archived, then your new PDF");
    expect(source).toContain("buildArchiveDialogCopy");
    expect(source).toContain("isOnlyActivePublishedVersion");
    expect(source).toContain("legalRowVersionLabel");
    expect(source).toContain("No published version");
    expect(source).toContain("Legal document version archived.");
    expect(source).toContain("Legal document version restored to draft.");
    expect(source).toContain("New draft created from archived version.");
    expect(source).toContain("Create New Version From This Version");
    expect(source).toContain("Historical acceptances stay attached");
    expect(source).toContain("New draft version created.");
    expect(source).toContain("bg-destructive");
    expect(helpers).toContain(
      "This legal document will have no published version. No older version will be activated automatically."
    );
  });

  it("disables already-added types in Add Legal Document", () => {
    expect(source).toContain("Already added");
    expect(source).toContain("EXISTING_LEGAL_TYPE_CREATE_MESSAGE");
    expect(source).toContain("Go to existing document");
    expect(source).toContain("availableLegalDocumentTypes");
    expect(source).toContain("existingLegalDocumentTypes");
    expect(helpers).toContain(
      "This legal document already exists. Upload a new version from the existing document instead."
    );
  });

  it("shows an onboarding readiness warning without blocking document management", () => {
    expect(source).toContain("/v1/admin/legal-documents/onboarding-readiness");
    expect(source).toContain("onboardingReadinessWarning");
    expect(source).toContain("AdminNextActionBanner");
    expect(source).toContain('data-testid="legal-onboarding-readiness-warning"');
    expect(source).toContain("disabled={!canManage}");
    expect(source).not.toContain("hasPublishedRequiredDocuments");
    expect(source).not.toContain("readinessWarning && !canManage");
  });
});
