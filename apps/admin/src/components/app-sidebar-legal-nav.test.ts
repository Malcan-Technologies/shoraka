import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("admin platform sidebar navigation", () => {
  const source = readFileSync(
    join(__dirname, "../components/app-sidebar.tsx"),
    "utf8"
  );

  it("shows Legal Documents linking to /legal-documents", () => {
    expect(source).toMatch(/title:\s*"Legal Documents"[\s\S]*?url:\s*"\/legal-documents"/);
  });

  it("shows Legal Acceptances linking to /legal-document-acceptances", () => {
    expect(source).toMatch(
      /title:\s*"Legal Acceptances"[\s\S]*?url:\s*"\/legal-document-acceptances"/
    );
  });

  it("allows Legal Documents with document_management.view", () => {
    expect(source).toContain('item.title === "Legal Documents" && canViewDocuments');
  });

  it("allows Legal Acceptances with document_management.view", () => {
    expect(source).toContain('item.title === "Legal Acceptances" && canViewDocuments');
  });

  it("hides the obsolete placeholder Documents nav entry", () => {
    expect(source).not.toMatch(/title:\s*"Documents"/);
  });
});
