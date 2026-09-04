import PizZip from "pizzip";
import { createFacilityAgreementFixture } from "./fa-fixture";
import type { FacilityAgreementMergeData } from "./fa-merge.types";
import {
  readFacilityAgreementTemplateBytes,
  renderFacilityAgreementDocx,
  resolveFacilityAgreementTemplatePath,
} from "./render-fa-docx";

function renderedXml(data: FacilityAgreementMergeData): string {
  const zip = new PizZip(renderFacilityAgreementDocx(data));
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

function assertWordXmlWellFormed(xml: string): void {
  const tokenRe = /<(\/?)([A-Za-z0-9:_-]+)([^>]*?)(\/?)\s*>/g;
  const stack: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(xml))) {
    const closing = match[1];
    const name = match[2];
    const attrs = match[3] ?? "";
    const empty = match[4];
    if (!name || name.startsWith("?") || name.startsWith("!")) continue;
    if (empty === "/" || attrs.trimEnd().endsWith("/")) continue;
    if (closing === "/") {
      const expected = stack.pop();
      if (expected !== name) {
        throw new Error(`closing ${name} expected ${expected ?? "none"}`);
      }
      continue;
    }
    stack.push(name);
  }
  if (stack.length > 0) throw new Error(`unclosed ${stack.slice(-3).join(", ")}`);
}

describe("renderFacilityAgreementDocx", () => {
  it("resolves the tagged template file", () => {
    expect(resolveFacilityAgreementTemplatePath()).toMatch(/arf-facility-agreement\.docx$/);
  });

  it("keeps well-formed Word XML so LibreOffice can convert the filled file", () => {
    const zip = new PizZip(readFacilityAgreementTemplateBytes());
    const templateXml = zip.file("word/document.xml")?.asText() ?? "";
    expect(() => assertWordXmlWellFormed(templateXml)).not.toThrow();
    expect(() => assertWordXmlWellFormed(renderedXml(createFacilityAgreementFixture()))).not.toThrow();
  });

  it("keeps yellow value tags and issuer/guarantor loops", () => {
    const zip = new PizZip(readFacilityAgreementTemplateBytes());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const plain = wordPlainText(xml);

    expect(plain).toContain("{facility_agreement_date}");
    expect(plain).toContain("{issuer_bank_account_number}");
    expect(plain).toContain("Account Number");
    expect(plain).toContain("Bank Branch");
    expect(plain).not.toContain("{issuer_bank_branch}");
    const accountNumberRow = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].find((row) =>
      row[0].includes(">Account Number</w:t>")
    )?.[0];
    expect(accountNumberRow).toContain("{issuer_bank_account_number}");
    expect(accountNumberRow).not.toContain("Account Name");
    expect(plain).toContain("{issuer_name}");
    expect(plain).toContain("{financing_limit_rm}");
    expect(plain).toContain("{#guarantors_individual}");
    expect(plain).toContain("{#guarantors_corporate}");
    expect(plain).toContain("{#issuer_signatories}");
    expect(plain).toContain("INVESTOR");
    expect(plain).toContain("AGENT");
    expect(plain).toContain("ISSUER");
    expect(plain).toContain("Name of Witness:");
    const issuerText = xml.indexOf(">ISSUER</w:t>");
    expect(issuerText).toBeGreaterThan(-1);
    const issuerPara = xml.lastIndexOf("<w:p ", issuerText);
    const issuerHeading = xml.slice(issuerPara, issuerText + 800);
    expect(issuerHeading).toContain('<w:footnoteReference w:id="5"/>');
    expect(issuerHeading).toContain('w:line="276"');
    const issuerBlockEnd = xml.indexOf("{/issuer_signatories}");
    expect(xml.slice(issuerPara, issuerBlockEnd)).not.toContain("leftBrace");
    expect(xml.slice(issuerPara, issuerBlockEnd)).not.toContain("<w:drawing");
    const loopStart = xml.indexOf("{#issuer_signatories}");
    const loopEnd = xml.indexOf("{/issuer_signatories}");
    const tableInLoop = xml.indexOf("<w:tbl", loopStart);
    expect(loopStart).toBeGreaterThan(-1);
    expect(tableInLoop).toBeGreaterThan(loopStart);
    expect(tableInLoop).toBeLessThan(loopEnd);
    expect(xml).toContain('<w:br w:type="page"/>');
    expect(runContaining(xml, "{facility_agreement_date}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{issuer_name}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{financing_limit_rm}")).toContain('w:val="yellow"');
  });

  it("renders fixture values and keeps empty tags visible", () => {
    const data = createFacilityAgreementFixture();
    const xml = renderedXml(data);
    const plain = wordPlainText(xml);

    expect(plain).toContain(data.issuer_name);
    expect(plain).toContain(data.facility_agreement_date);
    expect(plain).toContain(data.issuer_bank_account_number);
    expect(plain).toContain(data.issuer_bank_swift);
    expect(plain).toContain("Bank Branch");
    expect(plain).toContain("Ali Bin Abu");
    expect(plain).toContain("Siti Binti Ahmad");
    expect(plain).toContain("HOLDCO ONE SDN. BHD.");
    expect(plain).toContain("Name of Witness:");
    expect(plain).toContain("{drawdown_fee}");
    expect(plain).not.toContain("{#issuer_signatories}");
  });

  it("prints merge tags when scalars are empty", () => {
    const data = createFacilityAgreementFixture();
    data.issuer_name = "";
    data.financing_limit_rm = "";
    const xml = renderedXml(data);
    const plain = wordPlainText(xml);
    expect(plain).toContain("{issuer_name}");
    expect(plain).toContain("{financing_limit_rm}");
  });

  it("leaves Schedules 4 to 9 as in the clean copy, with no merge tags", () => {
    const zip = new PizZip(readFacilityAgreementTemplateBytes());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const plain = wordPlainText(xml);
    const scheduleStart = plain.indexOf("SCHEDULE 4");
    expect(scheduleStart).toBeGreaterThan(-1);
    const schedules = plain.slice(scheduleStart);

    expect(schedules).toContain("SCHEDULE 9");
    expect(schedules).not.toMatch(/\{[#/]?[A-Za-z][A-Za-z0-9_]*\}/);
    expect(schedules).toContain("[ISSUER NAME]");
    expect(schedules).toContain("[Issuer’s Address]");
    expect(schedules).toContain("Issuer : [●]");
    expect(schedules).toContain("Facility: [●]");
    expect(schedules).toContain("[ISSUER]");

    const rendered = wordPlainText(renderedXml(createFacilityAgreementFixture()));
    const renderedSchedules = rendered.slice(rendered.indexOf("SCHEDULE 4"));
    expect(renderedSchedules).toContain("[ISSUER NAME]");
    expect(renderedSchedules).toContain("Issuer : [●]");
    expect(renderedSchedules).not.toContain(createFacilityAgreementFixture().issuer_name);
  });
});
