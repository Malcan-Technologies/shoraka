import PizZip from "pizzip";
import { createJsgFixture } from "./jsg-fixture";
import type { JsgMergeData } from "./jsg-merge.types";
import {
  readJsgTemplateBytes,
  renderJsgDocx,
  resolveJsgTemplatePath,
} from "./render-jsg-docx";

function renderedXml(data: JsgMergeData): string {
  const zip = new PizZip(renderJsgDocx(data));
  return zip.file("word/document.xml")?.asText() ?? "";
}

function runContaining(xml: string, needle: string): string | null {
  const runRe = /<w:r\b[\s\S]*?<\/w:r>/g;
  let match: RegExpExecArray | null;
  while ((match = runRe.exec(xml))) {
    const texts = [...match[0].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) =>
      (m[1] ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    );
    if (texts.join("").includes(needle)) return match[0];
  }
  return null;
}

function paragraphContaining(xml: string, needle: string): string {
  const idx = xml.indexOf(needle);
  if (idx < 0) return "";
  const start = Math.max(xml.lastIndexOf("<w:p ", idx), xml.lastIndexOf("<w:p>", idx));
  const end = xml.indexOf("</w:p>", idx);
  if (start < 0 || end < 0) return "";
  return xml.slice(start, end + "</w:p>".length);
}

function wordPlainText(xml: string): string {
  let text = "";
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    text += (match[1] ?? "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  return text;
}

describe("renderJsgDocx", () => {
  it("resolves the tagged template file", () => {
    expect(resolveJsgTemplatePath()).toMatch(/arf-joint-several-guarantee\.docx$/);
  });

  it("keeps yellow value tags, guarantor loops, and wet-ink operator lines", () => {
    const zip = new PizZip(readJsgTemplateBytes());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const numbering = zip.file("word/numbering.xml")?.asText() ?? "";
    const plain = wordPlainText(xml);

    expect(plain).toContain("made on {guarantee_date} by");
    expect(plain).toContain("Schedule 1");
    expect(plain).not.toContain("Appendix 1");
    expect(plain).not.toContain("made onby");
    expect(plain).toContain("{letter_date}");
    expect(plain).toContain("{our_reference}");
    expect(plain).toContain("{#guarantors_individual}");
    expect(plain).toContain("{#corporate_guarantor_pages}");
    expect(plain).toContain("{#signatories}");
    expect(plain).not.toContain("{#signatory_rows}");
    expect(plain).not.toContain("{left_name}");
    expect(plain).toContain("{#schedule_guarantors}");
    expect(plain).toContain("{facility_description}");
    expect(plain).toContain("{issuer_business_address}");
    expect(plain).toContain("Signature of Witness");
    expect(plain).toContain("OPERATOR");
    expect(xml).not.toContain("{@page_break}");
    expect(xml).toContain("<w:cantSplit/>");
    expect(numbering).toContain('w:numId="20"');

    const operatorXmlSlice = xml.slice(xml.indexOf("OPERATOR"), xml.indexOf("SCHEDULE 1"));
    expect(operatorXmlSlice).toContain("Signed by its Attorney for and on behalf of");
    expect(operatorXmlSlice).toContain("in the presence of:-");
    expect(operatorXmlSlice).toContain("<w:tab");
    expect((operatorXmlSlice.match(/Signature of Witness/g) ?? []).length).toBe(1);
    expect((operatorXmlSlice.match(/\.{8,}/g) ?? []).length).toBeGreaterThanOrEqual(2);

    const linePara = paragraphContaining(xml, "{line}");
    expect(linePara).toContain('<w:numId w:val="20"/>');
    expect(linePara).toContain('<w:ilvl w:val="0"/>');
    expect(linePara).toContain('w:val="yellow"');
    const repPara = paragraphContaining(xml, "{rep_line}");
    expect(repPara).toContain('<w:numId w:val="20"/>');
    expect(repPara).toContain('<w:ilvl w:val="1"/>');

    expect(runContaining(xml, "{guarantee_date}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{issuer_name}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{nric}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{company_name}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{facility_description}")).toContain('w:val="yellow"');
  });

  it("renders fixture values into the preamble, execution pages, and Schedule 1", () => {
    const data = createJsgFixture();
    const xml = renderedXml(data);
    const plain = wordPlainText(xml);

    expect(plain).toContain(data.issuer_name);
    expect(plain).toContain(data.our_reference);
    expect(plain).toContain("Ali Bin Abu");
    expect(plain).toContain("Siti Binti Ahmad");
    expect(plain).toContain("HOLDCO ONE SDN. BHD.");
    expect(plain).toContain("Nora Abdullah");
    expect(plain).toContain("Farid Hassan");
    expect(plain).toContain(data.facility_description);
    expect(plain).toContain(data.issuer_business_address);
    expect(plain).toContain("For and on behalf of");
    expect(plain).toContain("Signature of Guarantor");
    expect((plain.match(/Signature of Guarantor/g) ?? []).length).toBe(4);
    expect((plain.match(/Signature of Witness/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(plain).toContain("OPERATOR");
    expect(plain).not.toContain("{#guarantors_individual}");
    expect(plain).not.toContain("[Issuer");

    const execXml = xml.slice(xml.indexOf("EXECUTION PAGE"));
    expect((execXml.match(/<w:br w:type="page"\/>/g) ?? []).length).toBe(2);
    const firstAli = execXml.indexOf("Ali Bin Abu");
    const firstSiti = execXml.indexOf("Siti Binti Ahmad");
    expect(firstAli).toBeGreaterThanOrEqual(0);
    expect(firstSiti).toBeGreaterThan(firstAli);
    expect(execXml.slice(firstAli, firstSiti)).not.toContain('<w:br w:type="page"/>');
  });

  it("prints merge tags when scalars are empty", () => {
    const data = createJsgFixture();
    data.issuer_name = "";
    data.facility_description = "";
    const xml = renderedXml(data);
    const plain = wordPlainText(xml);
    expect(plain).toContain("{issuer_name}");
    expect(plain).toContain("{facility_description}");
  });

  it("omits the corporate execution block when there are no company guarantors", () => {
    const data = createJsgFixture();
    data.guarantors_corporate = [];
    const xml = renderedXml(data);
    const plain = wordPlainText(xml);
    expect(plain).toContain("Ali Bin Abu");
    expect(plain).not.toContain("For and on behalf of");
    expect(xml).not.toContain("{#has_corporate_guarantor}");
  });
});
