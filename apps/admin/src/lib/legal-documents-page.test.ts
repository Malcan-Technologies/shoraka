import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin Legal Documents page UX", () => {
  const source = readFileSync(
    join(__dirname, "../app/legal-documents/page.tsx"),
    "utf8"
  );

  it("Add modal has Save as Draft and Publish Now with bordered sections", () => {
    expect(source).toContain("Add Legal Document");
    expect(source).toContain("Save as Draft");
    expect(source).toContain("Publish Now");
    expect(source).toContain('handleCreateDocument("draft")');
    expect(source).toContain('handleCreateDocument("publish")');
    expect(source).toContain("Document details");
    expect(source).toContain("Access and requirements");
    expect(source).toContain(">PDF</h3>");
    expect(source).toContain("Publishing");
    expect(source).toContain('placeholder="e.g. PDPA Notice and Consent"');
    expect(source).toContain('placeholder="Briefly explain what this document covers"');
    expect(source).toContain('id="legal-pdf"');
  });

  it("Publish Now orchestrates create, upload, and publish with reacceptanceRequired", () => {
    expect(source).toContain("publishVersionById");
    expect(source).toContain("createReacceptanceRequired");
    expect(source).toContain("shouldSkipVersionUpload");
    expect(source).toContain("nextCreateOrchestrationAfterVersion");
    expect(source).toContain("{ reacceptanceRequired: requireReaccept }");
  });

  it("defaults re-acceptance to No", () => {
    expect(source).toContain("setCreateReacceptanceRequired(false)");
    expect(source).toContain("setReacceptanceRequired(false)");
  });

  it("draft rows show Publish plus ellipsis; published use ellipsis menu actions", () => {
    expect(source).toContain("EllipsisHorizontalIcon");
    expect(source).toContain("More actions for");
    expect(source).toContain("View PDF");
    expect(source).toContain("Edit details");
    expect(source).toContain("Upload new version");
    expect(source).toContain("Version history");
    expect(source).toContain("Replace draft PDF");
    expect(source).toContain("openPublishDialog(doc, draft)");
    expect(source).toContain(">Document</TableHead>");
    expect(source).toContain(">Who must accept</TableHead>");
    expect(source).toContain(">Website</TableHead>");
  });

  it("existing draft publish dialog stays compact with bordered options", () => {
    expect(source).toContain("buildPublishDialogTitle");
    expect(source).toContain("ReacceptanceOptions");
    expect(source).toContain('sm:max-w-[460px]');
    expect(source).toContain("rounded-lg border p-3");
  });
});
