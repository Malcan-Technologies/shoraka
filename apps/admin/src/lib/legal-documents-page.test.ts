import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin Legal Documents page UX", () => {
  const source = readFileSync(
    join(__dirname, "../app/legal-documents/page.tsx"),
    "utf8"
  );

  it("keeps one-step create with PDF and no manual version field", () => {
    expect(source).toContain("Add Legal Document");
    expect(source).toContain('id="legal-pdf"');
    expect(source).toContain("Save as Draft");
    expect(source).toContain("Version numbers are assigned automatically");
    expect(source).not.toContain('id="legal-version"');
    expect(source).not.toContain("New definition");
  });

  it("separates who-must-accept from website visibility", () => {
    expect(source).toContain("Who must accept");
    expect(source).toContain("Show on website");
    expect(source).toContain("Which portal users see this during onboarding.");
    expect(source).toContain("show a link in the public footer");
    expect(source).not.toContain("Publicly visible");
    expect(source).not.toContain('label: audienceLabel("PUBLIC")');
  });

  it("uses a simpler table and brand primary Publish buttons", () => {
    expect(source).toContain(">Document</TableHead>");
    expect(source).toContain(">Status</TableHead>");
    expect(source).toContain(">Who must accept</TableHead>");
    expect(source).toContain(">Website</TableHead>");
    expect(source).not.toContain(">Audience</TableHead>");
    expect(source).not.toContain(">Onboarding</TableHead>");
    expect(source).not.toContain(">Public</TableHead>");
    expect(source).toContain("openPublishDialog");
    expect(source).toMatch(/<Button\s+size="sm"\s+onClick=\{\(\) => openPublishDialog/);
    expect(source).toContain('sm:max-w-[460px]');
  });

  it("publish defaults to No and posts reacceptanceRequired", () => {
    expect(source).toContain("buildPublishDialogTitle");
    expect(source).toContain("setReacceptanceRequired(false)");
    expect(source).toContain("{ reacceptanceRequired }");
    expect(source).toContain('type="radio"');
  });
});
