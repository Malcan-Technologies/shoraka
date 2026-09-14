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
    expect(source).toContain("COMPANY.address");
    expect(source).toContain("companyCopyrightLine");
    expect(source).toContain("EnvelopeIcon");
    expect(source).toContain("PhoneIcon");
    expect(source).not.toContain("Subscribe");
    expect(source).not.toContain("Enter your email");
    expect(source).not.toContain("Building the future of decentralized");
    expect(source).not.toContain("Social links");
    expect(source).not.toContain("SOCIAL_LINKS");
  });

  it("links Help Center off-site in a new tab", () => {
    expect(source).toContain("HELP_CENTER_URL");
    expect(source).toContain('target="_blank"');
  });
});
