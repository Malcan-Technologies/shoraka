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

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function wordPlainText(xml: string): string {
  let text = "";
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    text += decodeXmlText(match[1] ?? "");
  }
  return text;
}

function cellTexts(rowXml: string): string[] {
  return (rowXml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) ?? []).map((cell) => {
    let text = "";
    const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(cell))) {
      text += decodeXmlText(match[1] ?? "");
    }
    return text;
  });
}

function renderedXml(snapshot: InvestmentNoteCertificateSnapshot, audience: Parameters<typeof renderInvestmentNoteCertificateDocx>[1]) {
  const zip = new PizZip(renderInvestmentNoteCertificateDocx(snapshot, audience));
  return zip.file("word/document.xml")?.asText() ?? "";
}

function allocationTables(xml: string): string[] {
  const tables = xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) ?? [];
  return tables.filter((table) => {
    const text = wordPlainText(table);
    return text.includes("Investor ID") && text.includes("Share %") && text.includes("TOTAL");
  });
}

function allocationTableXml(xml: string): string {
  const tables = allocationTables(xml);
  expect(tables).toHaveLength(1);
  return tables[0] ?? "";
}

function allocationRowCount(xml: string): number {
  return (allocationTableXml(xml).match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []).length;
}

function allocationGridWidths(xml: string): number[] {
  return [...allocationTableXml(xml).matchAll(/<w:gridCol[^>]*w:w="(\d+)"/g)].map((match) =>
    Number(match[1])
  );
}

function allocationRows(xml: string): string[][] {
  const rows = allocationTableXml(xml).match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? [];
  return rows.map(cellTexts);
}

function identifierTableXml(xml: string): string {
  const tables = xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) ?? [];
  const table = tables.find((candidate) => {
    const text = wordPlainText(candidate);
    return text.includes("Certificate no.") && text.includes("Financing Note ID");
  });
  expect(table).toBeDefined();
  return table ?? "";
}

function identifierRows(xml: string): string[][] {
  const rows = identifierTableXml(xml).match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? [];
  return rows.map(cellTexts);
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
    expect(plain).not.toContain("{#showIssuerLegalIdentity}");
    expect(plain).not.toContain("{/showIssuerLegalIdentity}");
    expect(plain).not.toContain("{#isIssuerAudience}");
    expect(plain).not.toContain("{^isIssuerAudience}");
    expect(plain).not.toContain("{/isIssuerAudience}");
    expect(plain).not.toContain("{signatoryNameAndDate}");
    expect(plain).not.toContain("§COMPANY_STAMP_IMAGE§");
  });

  it("admin copy includes issuer identity and all investor names", () => {
    const xml = renderedXml(snapshot, { audience: "ADMIN" });
    const plain = wordPlainText(xml);
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
    expect(plain).toContain("Investor / Noteholder");
    expect(identifierRows(xml)).toEqual([
      ["Certificate no.", "IINC-NOTE-20260902-AAA", "Certificate date", "02 Sep 2026"],
      ["Financing Note ID", "NOTE-20260902-AAA", "Campaign ID", "NOTE-20260902-AAA"],
      ["Issuer ID", "ISS-001", "Business sector", "Manufacturing"],
      ["Issuer", "Helios Manufacturing Sdn Bhd", "Company no.", "1234567-A"],
    ]);
    const rows = allocationRows(xml);
    expect(rows[0]).toEqual([
      "No.",
      "Investor ID",
      "Investor / Noteholder",
      "Principal (RM)",
      "Share %",
      "Expected Profit (RM)",
      "Total payable (RM)",
    ]);
    expect(rows[1]?.[2]).toBe("Alice Tan");
    expect(rows[2]?.[2]).toBe("Bob Lee");
    expect(rows.at(-1)).toEqual(["", "", "TOTAL", "80,000.00", "100.00%", "2,000.00", "82,000.00"]);
    expect(allocationGridWidths(xml)).toEqual([450, 1150, 2150, 1350, 850, 1579, 1711]);
  });

  it("issuer copy includes investor IDs but never investor names", () => {
    const xml = renderedXml(snapshot, { audience: "ISSUER" });
    const plain = wordPlainText(xml);
    expect(plain).toContain("Helios Manufacturing Sdn Bhd");
    expect(plain).toContain("1234567-A");
    expect(plain).toContain("IVT-A");
    expect(plain).toContain("IVT-B");
    expect(plain).not.toContain("Alice Tan");
    expect(plain).not.toContain("Bob Lee");
    expect(plain).not.toContain("Investor / Noteholder");
    expect(identifierRows(xml)).toEqual([
      ["Certificate no.", "IINC-NOTE-20260902-AAA", "Certificate date", "02 Sep 2026"],
      ["Financing Note ID", "NOTE-20260902-AAA", "Campaign ID", "NOTE-20260902-AAA"],
      ["Issuer ID", "ISS-001", "Business sector", "Manufacturing"],
      ["Issuer", "Helios Manufacturing Sdn Bhd", "Company no.", "1234567-A"],
    ]);
    const rows = allocationRows(xml);
    expect(rows[0]).toEqual([
      "No.",
      "Investor ID",
      "Principal (RM)",
      "Share %",
      "Expected Profit (RM)",
      "Total payable (RM)",
    ]);
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveLength(6);
    expect(rows.at(-1)).toEqual(["", "TOTAL", "80,000.00", "100.00%", "2,000.00", "82,000.00"]);
    const widths = allocationGridWidths(xml);
    expect(widths).toEqual([450, 2500, 1620, 850, 1840, 1980]);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(9240);
  });

  it("investor A copy hides issuer legal identity and omits investor B", () => {
    const xml = renderedXml(snapshot, { audience: "INVESTOR", investorOrganizationId: "org-a" });
    const plain = wordPlainText(xml);
    expect(plain).toContain("Alice Tan");
    expect(plain).toContain("IVT-A");
    expect(plain).toContain("ISS-001");
    expect(plain).toContain("Manufacturing");
    expect(plain).toContain("Investor / Noteholder");
    expect(plain).not.toContain("Bob Lee");
    expect(plain).not.toContain("IVT-B");
    expect(plain).not.toContain("Helios Manufacturing Sdn Bhd");
    expect(plain).not.toContain("1234567-A");
    expect(plain).not.toContain("Company no.");
    const ids = identifierRows(xml);
    expect(ids).toEqual([
      ["Certificate no.", "IINC-NOTE-20260902-AAA", "Certificate date", "02 Sep 2026"],
      ["Financing Note ID", "NOTE-20260902-AAA", "Campaign ID", "NOTE-20260902-AAA"],
      ["Issuer ID", "ISS-001", "Business sector", "Manufacturing"],
    ]);
    expect(ids.flat()).not.toContain("Issuer");
    expect(ids.flat()).not.toContain("Company no.");
    const rows = allocationRows(xml);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.[1]).toBe("Investor ID");
    expect(rows[0]?.[2]).toBe("Investor / Noteholder");
    expect(rows[1]).toEqual(["1", "IVT-A", "Alice Tan", "50,000.00", "62.50%", "1,250.00", "51,250.00"]);
    expect(rows.at(-1)).toEqual(["", "", "TOTAL", "50,000.00", "62.50%", "1,250.00", "51,250.00"]);
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
    const adminXml = renderedXml(large, { audience: "ADMIN" });
    expect(allocationRowCount(adminXml)).toBe(14);
    const plain = wordPlainText(adminXml);
    expect(plain).toContain("IVT-1");
    expect(plain).toContain("IVT-12");
    expect(plain).toContain("Investor 12");
    const issuerXml = renderedXml(large, { audience: "ISSUER" });
    expect(allocationRowCount(issuerXml)).toBe(14);
    expect(allocationRows(issuerXml)[0]).toHaveLength(6);
    expect(wordPlainText(issuerXml)).not.toContain("Investor 12");
    expect(wordPlainText(issuerXml)).toContain("IVT-12");
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
    expect(data.noteReference).toBe("NOTE-20260902-AAA");
    expect(data.campaignId).toBe("NOTE-20260902-AAA");
    expect(data.investorScheduleReference).toBe("IS-NOTE-20260902-AAA-V01");
    expect(data.scheduleVersion).toBe("V01");
    expect(data.investors).toHaveLength(2);
    expect(data.isIssuerAudience).toBe(false);
    expect(data.showIssuerLegalIdentity).toBe(true);
    expect(buildCertificateDocxMergeData(snapshot, { audience: "ISSUER" }).isIssuerAudience).toBe(
      true
    );
    expect(buildCertificateDocxMergeData(snapshot, { audience: "ISSUER" }).showIssuerLegalIdentity).toBe(
      true
    );
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
    expect(data.isIssuerAudience).toBe(false);
    expect(data.showIssuerLegalIdentity).toBe(false);
    expect(data.issuerLegalName).toBe("—");
    expect(data.companyRegistration).toBe("—");
    expect(data.issuerReference).toBe("ISS-001");
    expect(data.businessSector).toBe("Manufacturing");
    expect(data.investors[0]?.investorId).toBe("IVT-A");
    expect(data.sumPrincipal).toBe("50,000.00");
    expect(data.sumSharePercent).toBe("62.50%");
    expect(data.sumExpectedProfit).toBe("1,250.00");
    expect(data.sumTotalPayable).toBe("51,250.00");
  });

  it("prints display references and never raw organization or note CUIDs", () => {
    const issuerCuid = "cmknlimvf0003grp0hsbmc1dp";
    const investorCuid = "cmkm0fc2r00059v8jzc71b39c";
    const noteCuid = "cmtjz7ez50002ks59pu7j2xml";
    const investmentCuid = "cmtjz7ez5investment00001";
    const withIds = sampleInvestmentNoteCertificateSnapshot([
      {
        investorOrganizationId: investorCuid,
        investorReference: "IVT-202609-A12",
        investorName: "Alice Tan",
        principal: 80_000,
        sharePercent: 100,
        expectedGrossProfit: 2_000,
        totalPayable: 82_000,
      },
    ]);
    withIds.note.noteId = noteCuid;
    withIds.note.issuerReference = "ISS-202608-DK3";
    withIds.note.noteReference = "NOTE-ARF-202609-5O3";
    withIds.note.campaignReference = "NOTE-ARF-202609-5O3";
    withIds.certificate.certificateNumber = "IINC-NOTE-ARF-202609-5O3";
    withIds.investorSchedule.scheduleReference = "IS-NOTE-ARF-202609-5O3-V01";

    const admin = wordPlainText(renderedXml(withIds, { audience: "ADMIN" }));
    const issuer = wordPlainText(renderedXml(withIds, { audience: "ISSUER" }));
    const investor = wordPlainText(
      renderedXml(withIds, { audience: "INVESTOR", investorOrganizationId: investorCuid })
    );

    for (const plain of [admin, issuer, investor]) {
      expect(plain).toContain("ISS-202608-DK3");
      expect(plain).toContain("IVT-202609-A12");
      expect(plain).toContain("IINC-NOTE-ARF-202609-5O3");
      expect(plain).toContain("NOTE-ARF-202609-5O3");
      expect(plain).toContain("IS-NOTE-ARF-202609-5O3-V01");
      expect(plain).not.toContain(issuerCuid);
      expect(plain).not.toContain(investorCuid);
      expect(plain).not.toContain(noteCuid);
      expect(plain).not.toContain(investmentCuid);
    }

    expect(admin).toContain("Alice Tan");
    expect(issuer).not.toContain("Alice Tan");
    expect(investor).toContain("Alice Tan");
  });

  it("keeps Company no. as — when the snapshot has no registration number", () => {
    const missing = sampleInvestmentNoteCertificateSnapshot();
    missing.note.companyRegistrationNumber = "—";
    const admin = wordPlainText(renderedXml(missing, { audience: "ADMIN" }));
    expect(admin).toContain("—");
    expect(admin).not.toContain("1234567-A");
    expect(buildCertificateDocxMergeData(missing, { audience: "ADMIN" }).companyRegistration).toBe(
      "—"
    );
  });

  it("fills automatic certificate date and leaves a missing signatory name blank", () => {
    const data = buildCertificateDocxMergeData(snapshot, { audience: "ADMIN" });
    expect(data.signatoryDate).toBe("02 Sep 2026");
    expect(data.authorisedSignatoryName).toBe("");
    expect(data.signatoryNameAndDate).toBe("02 Sep 2026");
    const plain = wordPlainText(renderedXml(snapshot, { audience: "ADMIN" }));
    expect(plain).toContain("02 Sep 2026");
    expect(plain).toContain("Company Stamp");
  });

  it("renders the authorised signatory name with the automatic date", () => {
    const named = sampleInvestmentNoteCertificateSnapshot();
    named.authorisation.authorisedSignatoryName = "Ahmad";
    const data = buildCertificateDocxMergeData(named, { audience: "ADMIN" });
    expect(data.signatoryNameAndDate).toBe("Ahmad / 02 Sep 2026");
    const plain = wordPlainText(renderedXml(named, { audience: "ADMIN" }));
    expect(plain).toContain("Ahmad / 02 Sep 2026");
  });

  it("embeds a company stamp image when provided", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFhAH+plp0OQAAAABJRU5ErkJggg==",
      "base64"
    );
    const docx = renderInvestmentNoteCertificateDocx(
      snapshot,
      { audience: "ADMIN" },
      { bytes: png, contentType: "image/png" }
    );
    const zip = new PizZip(docx);
    expect(zip.file("word/media/company-stamp.png")).toBeTruthy();
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    expect(xml).toContain("<w:drawing>");
    expect(xml).not.toContain("§COMPANY_STAMP_IMAGE§");
  });
});
