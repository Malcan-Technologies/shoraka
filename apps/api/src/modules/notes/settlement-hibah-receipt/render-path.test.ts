import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(relFromReceiptDir: string): string {
  return readFileSync(join(__dirname, relFromReceiptDir), "utf8");
}

describe("settlement hibah receipt render path isolation", () => {
  it("receipt generation uses LibreOffice DOCX conversion, not Chromium HTML", () => {
    const service = source("./service.ts");
    expect(service).toContain("renderSettlementHibahReceiptDocx");
    expect(service).toContain("convertDocxToPdf");
    expect(service).toContain('fileName: "settlement-hibah-receipt.docx"');
    expect(service).not.toContain("convertHtmlToPdf");
    expect(service).not.toContain("receipt-html");
    expect(service).not.toContain("buildSettlementHibahReceiptHtml");
  });

  it("does not change Investment Note Certificate DOCX conversion", () => {
    const certificate = source("../investment-note-certificate/service.ts");
    expect(certificate).toContain("renderInvestmentNoteCertificateDocx");
    expect(certificate).toContain("convertDocxToPdf");
    expect(certificate).not.toContain("renderSettlementHibahReceiptDocx");
  });

  it("does not change Investment Settlement Confirmation Playwright conversion", () => {
    const confirmation = source("../investment-settlement-confirmation/service.ts");
    expect(confirmation).toContain("renderConfirmationHtmlToPdfBuffer");
    expect(confirmation).toContain("buildInvestmentSettlementConfirmationHtml");
    expect(confirmation).not.toContain("convertHtmlToPdf");
    expect(confirmation).not.toContain("renderSettlementHibahReceiptDocx");
    expect(confirmation).not.toContain("applyCompanyStampToDocx");
    expect(confirmation).not.toContain("document-authorisation");
  });
});
