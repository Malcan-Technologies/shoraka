import { readFileSync } from "node:fs";
import { join } from "node:path";
import { legalChecklistStatusLabel } from "./legal-document-checklist";

describe("legal document checklist UI", () => {
  const checklistSource = readFileSync(
    join(__dirname, "legal-document-checklist.tsx"),
    "utf8"
  );
  const reviewSource = readFileSync(join(__dirname, "legal-documents-review.tsx"), "utf8");

  it("uses short status labels", () => {
    expect(legalChecklistStatusLabel("not_opened")).toBe(
      "Review the document to enable acceptance."
    );
    expect(legalChecklistStatusLabel("opened")).toBe("Ready to accept.");
    expect(legalChecklistStatusLabel("accepted")).toBe("Accepted");
  });

  it("uses Review document and hides version numbers", () => {
    expect(checklistSource).toContain("Review document");
    expect(checklistSource).not.toContain("Open PDF");
    expect(checklistSource).not.toContain("Version {");
    expect(checklistSource).toContain("divide-y divide-border");
    expect(checklistSource).toContain("rounded-2xl border bg-card shadow-sm");
  });

  it("keeps review flow on the shared checklist shell", () => {
    expect(reviewSource).toContain("LegalDocumentChecklistShell");
    expect(reviewSource).toContain("mode === \"onboarding\"");
    expect(reviewSource).toContain("mode === \"reacceptance\"");
  });
});
