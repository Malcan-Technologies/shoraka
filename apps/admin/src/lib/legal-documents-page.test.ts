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
    expect(source).toContain(">Updated</TableHead>");
    expect(source).toContain(">Actions</TableHead>");
    expect(source).not.toContain(">Type</TableHead>");
    expect(source).toContain("legalDocumentDisplayName(doc.type)");
    expect(source).toContain("current?.fileName");
    expect(source).toContain("EyeIcon");
    expect(source).toContain("PencilSquareIcon");
    expect(source).toContain("ArrowUpTrayIcon");
    expect(source).toContain("ArchiveBoxIcon");
    expect(source).toContain("CheckCircleIcon");
    expect(source).toContain(': "Publish"');
    expect(source).toContain("hasLegalVersionHistory");
    expect(source).toContain('title="Version history"');
    expect(source).not.toContain("EllipsisHorizontalIcon");
    expect(helpers).toContain('hour: "2-digit"');
  });

  it("uses semantic badges and status-based compact actions", () => {
    expect(source).toContain("legalStatusBadgeVariant");
    expect(source).toContain("onboardingBadgeVariant");
    expect(source).toContain("websiteBadgeVariant");
    expect(source).toContain("getLegalDocumentRowActions");
    expect(source).toContain("actions.showPublishButton");
    expect(source).toContain("Replace draft PDF");
    expect(source).toContain("Upload new version");
  });
});
