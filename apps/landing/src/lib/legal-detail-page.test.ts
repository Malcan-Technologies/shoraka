import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("public legal detail page markup", () => {
  const source = readFileSync(
    join(__dirname, "../app/(marketing)/legal/[slug]/page.tsx"),
    "utf8"
  );

  it("does not render raw filename or audience enum", () => {
    expect(source).not.toContain("file_name");
    expect(source).not.toContain("document.audience");
    expect(source).not.toContain("BOTH");
  });

  it("links breadcrumb back to /legal", () => {
    expect(source).toContain('href="/legal"');
    expect(source).toContain("Legal Documents");
  });

  it("uses View PDF as the primary action and Download as secondary", () => {
    expect(source).toContain("View PDF");
    expect(source).toContain("Download PDF");
    expect(source).toContain('variant="outline"');
    expect(source).toContain("publicLegalViewPath");
    expect(source).toContain("publicLegalDownloadPath");
  });

  it("stacks action buttons on mobile", () => {
    expect(source).toContain("flex-col");
    expect(source).toContain("sm:flex-row");
  });
});
