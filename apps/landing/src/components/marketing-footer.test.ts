import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("landing marketing footer legal links", () => {
  const source = readFileSync(join(__dirname, "marketing-footer.tsx"), "utf8");

  it("opens published legal PDFs via the shared public helper", () => {
    expect(source).toContain("useLandingFooterLegalLinks");
    expect(source).toContain("openPublicLegalPdf");
  });

  it("does not link to /legal or /legal/[slug]", () => {
    expect(source).not.toContain('href="/legal"');
    expect(source).not.toContain("`/legal/${");
    expect(source).not.toContain("/legal/");
  });

  it("keeps company registration contact and copyright blocks", () => {
    expect(source).toContain("COMPANY.legalName");
    expect(source).toContain("COMPANY.registrationNumber");
    expect(source).toContain("COMPANY.email");
    expect(source).toContain("All rights reserved");
  });

  it("links Help Center off-site in a new tab", () => {
    expect(source).toContain("HELP_CENTER_URL");
    expect(source).toContain('target="_blank"');
  });
});
