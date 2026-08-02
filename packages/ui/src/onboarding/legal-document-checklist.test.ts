import { readFileSync } from "node:fs";
import { join } from "node:path";
import { legalChecklistStatusLabel } from "./legal-document-checklist";

describe("legal document checklist UI", () => {
  const checklistSource = readFileSync(
    join(__dirname, "legal-document-checklist.tsx"),
    "utf8"
  );
  const onboardingSource = readFileSync(
    join(__dirname, "legal-documents-acceptance.tsx"),
    "utf8"
  );
  const reacceptanceSource = readFileSync(
    join(__dirname, "legal-reacceptance-panel.tsx"),
    "utf8"
  );

  it("uses shared row checklist status labels", () => {
    expect(legalChecklistStatusLabel("not_opened")).toBe(
      "You must open this document before accepting."
    );
    expect(legalChecklistStatusLabel("opened")).toBe(
      "Document opened — you can now accept."
    );
    expect(legalChecklistStatusLabel("accepted")).toBe("Accepted");
  });

  it("uses Open PDF and a single main card shell", () => {
    expect(checklistSource).toContain("Open PDF");
    expect(checklistSource).toContain("divide-y divide-border");
    expect(checklistSource).toContain("rounded-xl border bg-card shadow-sm");
    expect(checklistSource).not.toContain("shadow-lg");
    expect(checklistSource).not.toContain("View PDF");
  });

  it("keeps onboarding and re-acceptance on the shared checklist", () => {
    expect(onboardingSource).toContain("LegalDocumentChecklistShell");
    expect(onboardingSource).toContain("Accept and Continue");
    expect(onboardingSource).toContain("Please review and accept each required document");
    expect(reacceptanceSource).toContain("LegalDocumentChecklistShell");
    expect(reacceptanceSource).toContain("Accept updated documents");
    expect(reacceptanceSource).toContain(
      "Some legal documents have been updated. Please review and accept them before starting new transactions."
    );
  });

  it("does not use nested chunky document cards", () => {
    expect(onboardingSource).not.toContain("rounded-xl border border-border bg-muted/30 p-4");
    expect(reacceptanceSource).not.toContain("rounded-xl border border-border bg-muted/30 p-4");
  });
});
