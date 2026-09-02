import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(relativeFromComponents: string): string {
  return readFileSync(join(__dirname, relativeFromComponents), "utf8");
}

describe("Issuer Investment Note Certificate card", () => {
  const card = source("./issuer-investment-note-certificate-card.tsx");
  const page = source("../../app/notes/[id]/page.tsx");
  const hooks = source("../hooks/use-issuer-notes.ts");

  it("uses separate View and Download buttons", () => {
    expect(card).toContain("ArrowTopRightOnSquareIcon");
    expect(card).toContain("ArrowDownTrayIcon");
    expect(card).toMatch(/\bView\b/);
    expect(card).toMatch(/\bDownload\b/);
    expect(card).not.toContain("View / Download");
    expect(page).not.toMatch(/Investment Note Certificate[\s\S]{0,800}View \/ Download/);
  });

  it("keeps title, Ready/Failed/Pending status, and existing description", () => {
    expect(card).toContain("Investment Note Certificate");
    expect(card).toContain('label: "Ready"');
    expect(card).toContain('label: "Pending"');
    expect(card).toContain('label: "Failed"');
    expect(card).toContain("Issued after successful funding and disbursement.");
    expect(card).not.toContain("Retry");
  });

  it("View uses viewUrl and Download uses downloadUrl from the existing issuer payload", () => {
    expect(hooks).toContain("response.data.viewUrl");
    expect(hooks).toContain("response.data.downloadUrl");
    expect(hooks).toContain("useDownloadIssuerInvestmentNoteCertificate");
    expect(page).toContain("useDownloadIssuerInvestmentNoteCertificate");
    expect(page).toContain("IssuerInvestmentNoteCertificateCard");
  });
});
