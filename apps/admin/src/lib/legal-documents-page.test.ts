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
    expect(source).toContain("handleCreateDocument()");
    expect(source).not.toContain("Publish Now");
    expect(source).not.toContain("createReacceptanceRequired");
    expect(source).not.toContain("create-reacceptance");
    expect(source).not.toContain('handleCreateDocument("publish")');
  });

  it("create modal uses clearer section copy", () => {
    expect(source).toContain("Basic information");
    expect(source).toContain(">Type</Label>");
    expect(source).toContain("Access");
    expect(source).toContain("Applies to");
    expect(source).toContain("Required during onboarding");
    expect(source).toContain("Show on public website");
    expect(source).toContain(">File</h3>");
    expect(source).toContain('placeholder="e.g. PDPA Notice and Consent"');
    expect(source).toContain('placeholder="Briefly describe what this document covers"');
    expect(source).not.toContain("Document details");
    expect(source).not.toContain("Access and requirements");
    expect(source).not.toContain(">Publishing</h3>");
  });

  it("draft publish stays separate with re-acceptance defaults to No", () => {
    expect(source).toContain("openPublishDialog");
    expect(source).toContain("buildPublishDialogTitle");
    expect(source).toContain("setReacceptanceRequired(false)");
    expect(source).toContain("ReacceptanceOptions");
    expect(source).toContain("This version will become live for the users it applies to.");
    expect(source).toContain("EllipsisHorizontalIcon");
  });

  it("avoids duplicate definitions on upload retry", () => {
    expect(source).toContain("shouldSkipDefinitionCreate");
    expect(source).toContain("nextCreateOrchestrationAfterDefinition");
  });
});
