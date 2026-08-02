import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin Legal Documents page UX", () => {
  const source = readFileSync(
    join(__dirname, "../app/legal-documents/page.tsx"),
    "utf8"
  );

  it("create modal uploads PDF and saves as draft only", () => {
    expect(source).toContain("Add Legal Document");
    expect(source).toContain("Upload a PDF and save it as a draft.");
    expect(source).toContain("Save as Draft");
    expect(source).toContain('id="legal-pdf"');
    expect(source).not.toContain("Publish Now");
    expect(source).not.toContain("createReacceptanceRequired");
  });

  it("table has Version, Status, Applies to, Onboarding, Website columns", () => {
    expect(source).toContain(">Document</TableHead>");
    expect(source).toContain(">Version</TableHead>");
    expect(source).toContain(">Status</TableHead>");
    expect(source).toContain(">Applies to</TableHead>");
    expect(source).toContain(">Onboarding</TableHead>");
    expect(source).toContain(">Website</TableHead>");
    expect(source).toContain("legalStatusBadgeVariant");
    expect(source).toContain("onboardingBadgeVariant");
    expect(source).toContain("websiteBadgeVariant");
    expect(source).toContain("getLegalDocumentRowActions");
  });

  it("draft shows Publish button; menu actions come from helper", () => {
    expect(source).toContain("actions.showPublishButton");
    expect(source).toContain("openPublishDialog(doc, draft)");
    expect(source).toContain("EllipsisHorizontalIcon");
    expect(source).toContain("Replace draft PDF");
    expect(source).toContain("Upload new version");
    expect(source).not.toMatch(/case "publish"/);
  });

  it("avoids duplicate definitions on upload retry", () => {
    expect(source).toContain("shouldSkipDefinitionCreate");
    expect(source).toContain("nextCreateOrchestrationAfterDefinition");
  });
});
