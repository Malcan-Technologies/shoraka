import PizZip from "pizzip";
import { PROSPECTUS_FIXED_SHARIAH_PRINCIPLE } from "@cashsouk/types";
import { buildCertificateDocxMergeData } from "./certificate-merge-data";
import {
  manyCertificateInvestors,
  sampleInvestmentNoteCertificateSnapshot,
} from "./certificate-fixture";
import {
  renderInvestmentNoteCertificateDocx,
  resolveCertificateTemplatePath,
} from "./render-certificate-docx";
import type { InvestmentNoteCertificateSnapshot } from "./types";

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

function renderedXml(snapshot: InvestmentNoteCertificateSnapshot, audience: Parameters<typeof renderInvestmentNoteCertificateDocx>[1]) {
  const zip = new PizZip(renderInvestmentNoteCertificateDocx(snapshot, audience));
  return zip.file("word/document.xml")?.asText() ?? "";
}

function allocationTableXml(xml: string): string {
  const tables = xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) ?? [];
  return tables[8] ?? "";
}

function allocationRowCount(xml: string): number {
  return (allocationTableXml(xml).match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []).length;
}

describe("renderInvestmentNoteCertificateDocx", () => {
  const snapshot = sampleInvestmentNoteCertificateSnapshot();

  it("resolves the tagged runtime template", () => {
    expect(resolveCertificateTemplatePath()).toMatch(
      /islamic-investment-note-certificate-v1\.docx$/
    );
  });

  it("returns a valid DOCX buffer without leftover merge tags", () => {
    const docx = renderInvestmentNoteCertificateDocx(snapshot, { audience: "ADMIN" });
    expect(docx.subarray(0, 2).toString("ascii")).toBe("PK");
    const xml = renderedXml(snapshot, { audience: "ADMIN" });
    const plain = wordPlainText(xml);
    expect(plain).not.toContain("{certificateNumber}");
    expect(plain).not.toContain("{#investors}");
    expect(plain).not.toContain("{/investors}");
    expect(plain).not.toContain("{issuerLegalName}");
  });

  it("admin copy includes issuer identity and all investor names", () => {
    const plain = wordPlainText(renderedXml(snapshot, { audience: "ADMIN" }));
    expect(plain).toContain("IINC-NOTE-20260902-AAA");
    expect(plain).toContain("IS-NOTE-20260902-AAA-V01");
    expect(plain).toContain("V01");
    expect(plain).toContain("Helios Manufacturing Sdn Bhd");
    expect(plain).toContain("1234567-A");
    expect(plain).toContain("Alice Tan");
    expect(plain).toContain("Bob Lee");
    expect(plain).toContain("IVT-A");
    expect(plain).toContain("IVT-B");
    expect(plain).toContain(PROSPECTUS_FIXED_SHARIAH_PRINCIPLE);
  });

  it("issuer copy includes investor IDs but never investor names", () => {
    const plain = wordPlainText(renderedXml(snapshot, { audience: "ISSUER" }));
    expect(plain).toContain("Helios Manufacturing Sdn Bhd");
    expect(plain).toContain("IVT-A");
    expect(plain).toContain("IVT-B");
    expect(plain).not.toContain("Alice Tan");
    expect(plain).not.toContain("Bob Lee");
  });

  it("investor A copy hides issuer legal identity and omits investor B", () => {
    const plain = wordPlainText(
      renderedXml(snapshot, { audience: "INVESTOR", investorOrganizationId: "org-a" })
    );
    expect(plain).toContain("Alice Tan");
    expect(plain).toContain("IVT-A");
    expect(plain).toContain("ISS-001");
    expect(plain).not.toContain("Bob Lee");
    expect(plain).not.toContain("IVT-B");
    expect(plain).not.toContain("Helios Manufacturing Sdn Bhd");
    expect(plain).not.toContain("1234567-A");
  });

  it("investor B cannot appear in investor A document", () => {
    const plain = wordPlainText(
      renderedXml(snapshot, { audience: "INVESTOR", investorOrganizationId: "org-a" })
    );
    expect(plain).not.toContain("org-b");
    expect(plain).not.toContain("IVT-B");
  });

  it("grows investor rows dynamically beyond the template's 10 example lines", () => {
    const large = sampleInvestmentNoteCertificateSnapshot(manyCertificateInvestors(12));
    const xml = renderedXml(large, { audience: "ADMIN" });
    expect(allocationRowCount(xml)).toBe(14);
    const plain = wordPlainText(xml);
    expect(plain).toContain("IVT-1");
    expect(plain).toContain("IVT-12");
    expect(plain).toContain("Investor 12");
  });

  it("renders a single investor row plus TOTAL", () => {
    const one = sampleInvestmentNoteCertificateSnapshot([snapshot.investors[0]!]);
    expect(allocationRowCount(renderedXml(one, { audience: "ADMIN" }))).toBe(3);
  });

  it("payment schedule uses frozen snapshot amounts", () => {
    const plain = wordPlainText(renderedXml(snapshot, { audience: "ADMIN" }));
    expect(plain).toContain("30 November 2026");
    expect(plain).toContain("80,000.00");
    expect(plain).toContain("2,000.00");
    expect(plain).toContain("82,000.00");
  });

  it("admin/issuer TOTAL row reconciles to frozen note totals", () => {
    const data = buildCertificateDocxMergeData(snapshot, { audience: "ADMIN" });
    expect(data.certificateNumber).toBe("IINC-NOTE-20260902-AAA");
    expect(data.investorScheduleReference).toBe("IS-NOTE-20260902-AAA-V01");
    expect(data.scheduleVersion).toBe("V01");
    expect(data.investors).toHaveLength(2);
    expect(data.sumPrincipal).toBe("80,000.00");
    expect(data.sumSharePercent).toBe("100.00%");
    expect(data.sumExpectedProfit).toBe("2,000.00");
    expect(data.sumTotalPayable).toBe("82,000.00");
    expect(data.paymentPrincipal).toBe("80,000.00");
    expect(data.paymentExpectedProfit).toBe("2,000.00");
    expect(data.paymentTotalPayable).toBe("82,000.00");
  });

  it("investor TOTAL row is that investor's allocation only", () => {
    const data = buildCertificateDocxMergeData(snapshot, {
      audience: "INVESTOR",
      investorOrganizationId: "org-a",
    });
    expect(data.investors).toHaveLength(1);
    expect(data.investors[0]?.investorId).toBe("IVT-A");
    expect(data.sumPrincipal).toBe("50,000.00");
    expect(data.sumSharePercent).toBe("62.50%");
    expect(data.sumExpectedProfit).toBe("1,250.00");
    expect(data.sumTotalPayable).toBe("51,250.00");
  });
});
