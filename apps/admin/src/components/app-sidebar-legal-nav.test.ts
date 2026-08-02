import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("admin platform sidebar navigation", () => {
  const source = readFileSync(
    join(__dirname, "../components/app-sidebar.tsx"),
    "utf8"
  );

  it("keeps Documents linking to /documents", () => {
    expect(source).toMatch(/title:\s*"Documents"[\s\S]*?url:\s*"\/documents"/);
  });

  it("shows Legal Documents linking to /legal-documents", () => {
    expect(source).toMatch(/title:\s*"Legal Documents"[\s\S]*?url:\s*"\/legal-documents"/);
  });

  it("allows Legal Documents with document_management.view", () => {
    expect(source).toContain('item.title === "Legal Documents" && canViewDocuments');
  });

  it("does not replace the Documents item", () => {
    expect(source).toContain('title: "Documents"');
    expect(source).toContain('title: "Legal Documents"');
    expect(source.indexOf('title: "Documents"')).toBeLessThan(
      source.indexOf('title: "Legal Documents"')
    );
  });
});
