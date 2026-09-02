import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(relFromConfirmationDir: string): string {
  return readFileSync(join(__dirname, relFromConfirmationDir), "utf8");
}

describe("investment settlement confirmation render path isolation", () => {
  it("confirmation generation uses Playwright HTML conversion, not Gotenberg Chromium or DOCX", () => {
    const service = source("./service.ts");
    expect(service).toContain("buildInvestmentSettlementConfirmationHtml");
    expect(service).toContain("renderConfirmationHtmlToPdfBuffer");
    expect(service).toContain("PLAYWRIGHT_FAILED");
    expect(service).not.toContain("convertHtmlToPdf");
    expect(service).not.toContain("convert-html-to-pdf");
    expect(service).not.toContain("convert-docx-to-pdf");
    expect(service).not.toContain("convertDocxToPdf");
    expect(service).not.toContain("/forms/chromium/convert/html");
  });

  it("confirmation Playwright wrapper reuses the shared Prospectus helper", () => {
    const wrapper = source("./render-confirmation-html-to-pdf.ts");
    expect(wrapper).toContain("renderHtmlToPdfBuffer");
    expect(wrapper).toContain('logLabel: "investment-settlement-confirmation"');
    expect(wrapper).not.toContain("chromium.launch");
    expect(wrapper).not.toContain("convertHtmlToPdf");
  });

  it("does not change Investment Note Certificate DOCX conversion", () => {
    const certificate = source("../investment-note-certificate/service.ts");
    expect(certificate).toContain("renderInvestmentNoteCertificateDocx");
    expect(certificate).toContain("convertDocxToPdf");
    expect(certificate).not.toContain("renderConfirmationHtmlToPdfBuffer");
  });

  it("does not change Settlement & Hibah Receipt DOCX conversion", () => {
    const receipt = source("../settlement-hibah-receipt/service.ts");
    expect(receipt).toContain("renderSettlementHibahReceiptDocx");
    expect(receipt).toContain("convertDocxToPdf");
    expect(receipt).not.toContain("renderConfirmationHtmlToPdfBuffer");
  });
});
