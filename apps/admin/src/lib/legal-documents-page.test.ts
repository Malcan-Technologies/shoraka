import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin Legal Documents page UX", () => {
  const source = readFileSync(
    join(__dirname, "../app/legal-documents/page.tsx"),
    "utf8"
  );

  it("keeps a single Add Legal Document create modal with PDF upload", () => {
    expect(source).toContain("Add Legal Document");
    expect(source).toContain("Create the legal document and upload its first PDF version.");
    expect(source).toContain("Save as Draft");
    expect(source).toContain('id="legal-pdf"');
    expect(source).toContain("validateLegalPdfFile");
    expect(source).not.toContain("New definition");
    expect(source).not.toContain("Upload a draft PDF next");
  });

  it("uses compact Admin table columns like Site Documents", () => {
    expect(source).toContain(">Document</TableHead>");
    expect(source).toContain(">Type</TableHead>");
    expect(source).toContain(">Audience</TableHead>");
    expect(source).toContain(">Version</TableHead>");
    expect(source).toContain(">Status</TableHead>");
    expect(source).toContain(">Onboarding</TableHead>");
    expect(source).toContain(">Public</TableHead>");
    expect(source).toContain(">Updated</TableHead>");
    expect(source).toContain(">Actions</TableHead>");
    expect(source).not.toContain("Current Version");
    expect(source).toContain('className="flex justify-end gap-1"');
  });

  it("publish dialog uses title+version helper, defaults to No, and standard radios", () => {
    expect(source).toContain("buildPublishDialogTitle");
    expect(source).toContain("setReacceptanceRequired(false)");
    expect(source).toContain("Require existing users to accept this version again?");
    expect(source).toContain(
      "This version will become the current version shown to applicable users."
    );
    expect(source).toContain('type="radio"');
    expect(source).toContain("{ reacceptanceRequired }");
    expect(source).toContain('sm:max-w-[480px]');
    expect(source).toContain('className="flex cursor-pointer items-start gap-2"');
    expect(source).not.toContain("rounded-lg border p-3\">\n                <input");
  });

  it("orchestrates create definition then draft upload without duplicates on retry", () => {
    expect(source).toContain("shouldSkipDefinitionCreate");
    expect(source).toContain("nextCreateOrchestrationAfterDefinition");
    expect(source).toContain("uploadDraftVersion");
    expect(source).toContain("definitionCreatedInAttempt");
  });

  it("supports upload new version, replace draft, history, and archive confirm", () => {
    expect(source).toContain("Upload New Version");
    expect(source).toContain("Replace Draft PDF");
    expect(source).toContain("Version History");
    expect(source).toContain("Archive");
  });
});
