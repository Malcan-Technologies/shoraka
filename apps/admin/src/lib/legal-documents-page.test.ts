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

  it("create modal uploads PDF and saves as draft only", () => {
    expect(source).toContain("Add Legal Document");
    expect(source).toContain("Save as Draft");
    expect(source).toContain('id="legal-pdf"');
    expect(source).not.toContain("Publish Now");
  });

  it("table follows Document Management column order with filename and type", () => {
    expect(source).toContain(">Document</TableHead>");
    expect(source).toContain(">Type</TableHead>");
    expect(source).toContain(">Version</TableHead>");
    expect(source).toContain(">Status</TableHead>");
    expect(source).toContain(">Applies to</TableHead>");
    expect(source).toContain(">Onboarding</TableHead>");
    expect(source).toContain(">Website</TableHead>");
    expect(source).toContain(">Updated</TableHead>");
    expect(source).toContain(">Actions</TableHead>");
    expect(source).toContain("current?.fileName");
    expect(source).toContain("No PDF yet");
    expect(source).toContain("LEGAL_DOCUMENT_TYPE_LABELS[doc.type]");
    expect(helpers).toContain('hour: "2-digit"');
    expect(helpers).toContain('minute: "2-digit"');
  });

  it("uses semantic badges and status-based row actions", () => {
    expect(source).toContain("legalStatusBadgeVariant");
    expect(source).toContain("onboardingBadgeVariant");
    expect(source).toContain("websiteBadgeVariant");
    expect(source).toContain("getLegalDocumentRowActions");
    expect(source).toContain("actions.showPublishButton");
    expect(source).toContain("Replace draft PDF");
    expect(source).toContain("Upload new version");
  });
});
