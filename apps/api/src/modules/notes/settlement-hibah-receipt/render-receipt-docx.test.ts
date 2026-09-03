import PizZip from "pizzip";
import { SETTLEMENT_CONFIRMATION_COPY } from "./types";
import { sampleSettlementHibahReceiptSnapshot } from "./receipt-fixture";
import { buildSettlementHibahReceiptDocxMergeData } from "./receipt-merge-data";
import {
  renderSettlementHibahReceiptDocx,
  resolveSettlementHibahReceiptTemplatePath,
} from "./render-receipt-docx";

function wordPlainText(xml: string): string {
  let text = "";
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    text += (match[1] ?? "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
  }
  return text;
}

function renderedXml(snapshot = sampleSettlementHibahReceiptSnapshot()) {
  const zip = new PizZip(renderSettlementHibahReceiptDocx(snapshot));
  return zip.file("word/document.xml")?.asText() ?? "";
}

describe("renderSettlementHibahReceiptDocx", () => {
  it("resolves the tagged runtime template", () => {
    expect(resolveSettlementHibahReceiptTemplatePath()).toMatch(
      /settlement-hibah-receipt-v1\.docx$/
    );
  });

  it("returns a valid DOCX buffer without leftover merge tags", () => {
    const snapshot = sampleSettlementHibahReceiptSnapshot();
    const docx = renderSettlementHibahReceiptDocx(snapshot);
    expect(docx.subarray(0, 2).toString("ascii")).toBe("PK");
    const plain = wordPlainText(renderedXml(snapshot));
    expect(plain).not.toContain("{receiptNumber}");
    expect(plain).not.toContain("{hibahAmount}");
    expect(plain).not.toContain("{issuerLegalName}");
    expect(plain).not.toContain("SR-YYYY-0000");
    expect(plain).not.toContain("§COMPANY_STAMP_IMAGE§");
  });

  it("fills frozen identifiers, invoice, paymaster and dates", () => {
    const plain = wordPlainText(renderedXml());
    expect(plain).toContain("SET-ARF-202608-A52");
    expect(plain).toContain("02 Sep 2026");
    expect(plain).toContain("ISS-1");
    expect(plain).toContain("Helios Sdn Bhd");
    expect(plain).toContain("1234567-A");
    expect(plain).toContain("ARF-202608-A52 / FAC-1");
    expect(plain).toContain("Paymaster Co");
    expect(plain).toContain("INV-9");
    expect(plain).toContain("RM 100,000.00");
    expect(plain).toContain("30 Nov 2026");
    expect(plain).toContain("15 Aug 2026");
    expect(plain).toContain("BANK-REF-1");
    expect(plain).toContain("Fully settled");
    expect(plain).toContain("IS-ARF-202608-A52-V01");
  });

  it("fills frozen collection, application, hibah and reconciliation amounts", () => {
    const data = buildSettlementHibahReceiptDocxMergeData(
      sampleSettlementHibahReceiptSnapshot()
    );
    expect(data.receiptNumber).toBe("SET-ARF-202608-A52");
    expect(data.grossReceiptAmount).toBe("105,000.00");
    expect(data.investorPrincipal).toBe("100,000.00");
    expect(data.investorProfitGross).toBe("3,000.00");
    expect(data.unpaidContractualFees).toBe("0.00");
    expect(data.tawidhAmount).toBe("200.00");
    expect(data.gharamahAmount).toBe("50.00");
    expect(data.priorPaymentsCredits).toBe("(0.00)");
    expect(data.totalApplied).toBe("103,250.00");
    expect(data.hibahGrossAmount).toBe("105,000.00");
    expect(data.hibahAppliedAmount).toBe("(103,250.00)");
    expect(data.hibahAmount).toBe("1,750.00");
    expect(data.financingSettled).toBe("RM 103,250.00");
    expect(data.hibahToIssuer).toBe("RM 1,750.00");
    expect(data.totalAllocated).toBe("RM 105,000.00");
    expect(data.unallocatedBalance).toBe("RM 0.00");
    expect(data.investorScheduleReference).toBe("IS-ARF-202608-A52-V01");

    const plain = wordPlainText(renderedXml());
    expect(plain).toContain("105,000.00");
    expect(plain).toContain("3,000.00");
    expect(plain).toContain("200.00");
    expect(plain).toContain("50.00");
    expect(plain).toContain("(0.00)");
    expect(plain).toContain("103,250.00");
    expect(plain).toContain("(103,250.00)");
    expect(plain).toContain("1,750.00");
  });

  it("renders a zero-Hibah issuer residual as 0.00", () => {
    const snapshot = sampleSettlementHibahReceiptSnapshot({
      hibahAmount: 0,
      totalApplied: 105_000,
      totalAllocated: 105_000,
    });
    const data = buildSettlementHibahReceiptDocxMergeData(snapshot);
    expect(data.hibahAmount).toBe("0.00");
    expect(data.hibahToIssuer).toBe("RM 0.00");
    expect(wordPlainText(renderedXml(snapshot))).toContain("RM 0.00");
  });

  it("preserves legal section titles, confirmation wording and company stamp placeholder", () => {
    const plain = wordPlainText(renderedXml());
    expect(plain).toContain("SETTLEMENT AND HIBAH RECEIPT");
    expect(plain).toContain("PAID — ISSUER COPY");
    expect(plain).toContain("GROSS COLLECTION");
    expect(plain).toContain("APPLICATION TOWARDS SETTLEMENT");
    expect(plain).toContain("HIBAH (REFUND)");
    expect(plain).toContain("HIBAH DETAILS AND FINAL RECONCILIATION");
    expect(plain).toContain("SETTLEMENT CONFIRMATION");
    expect(plain).toContain("Company Stamp");
    expect(plain).toContain("________________________");
    expect(plain).toContain("Contracted profit payable");
    expect(plain).toContain("Full tenure to maturity");
    expect(plain).toContain("Unpaid contractual fees");
    expect(plain).toContain("Participating Investors/Noteholders");
    expect(plain).toContain(
      "Shoraka Suyula Platform Sdn Bhd as duly authorised agent for investor, issuer and platform operator"
    );
    expect(plain).toContain("We acknowledge receipt of the gross paymaster collection stated above");
    expect(plain).toContain("Bai");
    expect(SETTLEMENT_CONFIRMATION_COPY).toContain("hibah granted");
  });

  it("does not print investor-private data or raw database identifiers", () => {
    const issuerCuid = "cmknlimvf0003grp0hsbmc1dp";
    const noteCuid = "cmtjz7ez50002ks59pu7j2xml";
    const settlementCuid = "cmtjz7ez5settlement00001";
    const invoiceCuid = "cmtjz7ez5invoice00000001";
    const paymentCuid = "cmtjz7ez5payment00000001";
    const snapshot = sampleSettlementHibahReceiptSnapshot({
      settlementId: settlementCuid,
      noteId: noteCuid,
      issuerReference: "ISS-1",
      invoiceNumber: "INV-9",
      paymentReference: "BANK-REF-1",
    });
    const plain = wordPlainText(renderedXml(snapshot));
    expect(plain).toContain("ISS-1");
    expect(plain).toContain("SET-ARF-202608-A52");
    expect(plain).toContain("ARF-202608-A52");
    expect(plain).toContain("IS-ARF-202608-A52-V01");
    expect(plain).toContain("INV-9");
    expect(plain).toContain("BANK-REF-1");
    expect(plain).not.toContain("Alice");
    expect(plain).not.toContain("IVT-");
    expect(plain).not.toContain(issuerCuid);
    expect(plain).not.toContain(noteCuid);
    expect(plain).not.toContain(settlementCuid);
    expect(plain).not.toContain(invoiceCuid);
    expect(plain).not.toContain(paymentCuid);
  });

  it("prints an em dash instead of a raw issuer CUID", () => {
    const issuerCuid = "cmknlimvf0003grp0hsbmc1dp";
    const snapshot = sampleSettlementHibahReceiptSnapshot({ issuerReference: issuerCuid });
    const data = buildSettlementHibahReceiptDocxMergeData(snapshot);
    expect(data.issuerReference).toBe("—");
    expect(wordPlainText(renderedXml(snapshot))).not.toContain(issuerCuid);
    expect(data.tawidhAmount).toBe("200.00");
    expect(data.gharamahAmount).toBe("50.00");
    expect(data.hibahAmount).toBe("1,750.00");
  });

  it("embeds the selected company stamp when provided", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFhAH+plp0OQAAAABJRU5ErkJggg==",
      "base64"
    );
    const docx = renderSettlementHibahReceiptDocx(sampleSettlementHibahReceiptSnapshot(), {
      bytes: png,
      contentType: "image/png",
    });
    const zip = new PizZip(docx);
    expect(zip.file("word/media/company-stamp.png")).toBeTruthy();
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    expect(xml).toContain("<w:drawing>");
    expect(xml).not.toContain("§COMPANY_STAMP_IMAGE§");
  });
});
