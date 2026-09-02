import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(relFromCertificateDir: string): string {
  return readFileSync(join(__dirname, relFromCertificateDir), "utf8");
}

describe("investment note certificate render path isolation", () => {
  it("certificate generation uses LibreOffice DOCX conversion, not Chromium HTML", () => {
    const service = source("./service.ts");
    expect(service).toContain("renderInvestmentNoteCertificateDocx");
    expect(service).toContain("convertDocxToPdf");
    expect(service).toContain('fileName: "investment-note-certificate.docx"');
    expect(service).not.toContain("convertHtmlToPdf");
    expect(service).not.toContain("certificate-html");
    expect(service).not.toContain("buildInvestmentNoteCertificateHtml");
  });

  it("does not change Settlement & Hibah Receipt conversion helper isolation from the certificate", () => {
    const receipt = source("../settlement-hibah-receipt/service.ts");
    expect(receipt).toContain("convertDocxToPdf");
    expect(receipt).toContain("renderSettlementHibahReceiptDocx");
    expect(receipt).not.toContain("renderInvestmentNoteCertificateDocx");
  });

  it("does not change Investment Settlement Confirmation HTML conversion", () => {
    const confirmation = source("../investment-settlement-confirmation/service.ts");
    expect(confirmation).toContain("convertHtmlToPdf");
    expect(confirmation).toContain("buildInvestmentSettlementConfirmationHtml");
    expect(confirmation).not.toContain("renderInvestmentNoteCertificateDocx");
  });

  it("does not change Letter of Offer LibreOffice conversion", () => {
    const lo = source("../../applications/letter-of-offer/convert-docx-to-pdf.ts");
    expect(lo).toContain('from "../../../lib/gotenberg/convert-docx-to-pdf"');
    const generated = source("../../generated-documents/service.ts");
    expect(generated).toContain("convertDocxToPdf");
  });
});
