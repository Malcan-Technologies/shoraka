import PizZip from "pizzip";
import { createFacilityAgreementFixture } from "./fa-fixture";
import type { FacilityAgreementMergeData } from "./fa-merge.types";
import { splitFacilityAgreementXmlAtSchedule4 } from "./fa-document-xml";
import {
  readFacilityAgreementTemplateBytes,
  renderFacilityAgreementDocx,
  resolveFacilityAgreementTemplatePath,
} from "./render-fa-docx";
import {
  FA_ISSUER_SIGNATORY_COLON_TWIPS,
  FA_ISSUER_WITNESS_COLON_TWIPS,
  paragraphContaining,
  paragraphPinsFaExecutionValueWrap,
  paragraphPinsTableHangingLabelWrap,
} from "../../generated-documents/hanging-execution-label";

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
    expect(plain).not.toContain("{sub_limit_per_invoice_rm}");
    expect(plain).not.toContain("With below Sub-Limits");
    expect(plain).toContain("{#guarantors_individual}");
    expect(plain).toContain("{#guarantors_corporate}");
    expect(plain).toContain("{#issuer_signatory_pages}");
    expect(plain).toContain("{#issuer_signatories}");
    expect(plain).toContain("{investor_1_name}");
    expect(plain).toContain("{investor_1_designation}");
    expect(plain).toContain("{investor_2_name}");
    expect(plain).toContain("{agent_1_name}");
    expect(plain).toContain("{agent_2_designation}");
    expect(plain).toContain("{witness_name}");
    expect(plain).toContain("{witness_nric}");
    expect(plain).toContain("INVESTOR");
    expect(plain).toContain("AGENT");
    expect(plain).toContain("ISSUER");
    expect(plain).toContain("Name of Witness:");
    const investorXml = xml.indexOf(">INVESTOR</w:t>");
    const agentXml = xml.indexOf(">AGENT</w:t>");
    const issuerXml = xml.indexOf(">ISSUER</w:t>");
    expect(investorXml).toBeGreaterThan(-1);
    expect(agentXml).toBeGreaterThan(investorXml);
    expect(issuerXml).toBeGreaterThan(agentXml);
    const investorPlain = wordPlainText(xml.slice(investorXml, agentXml));
    const agentPlain = wordPlainText(xml.slice(agentXml, issuerXml));
    expect(investorPlain).toContain("SIGNED BY authorised representatives of");
    expect(investorPlain).toContain("SHORAKA SUYULA PLATFORM SDN. BHD.");
    expect(investorPlain).toContain("Investor Agreement signed with");
    expect(investorPlain).toContain("{investor_1_name}");
    expect(investorPlain).toContain("{investor_2_designation}");
    expect(agentPlain).toContain("SIGNED BY");
    expect(agentPlain).toContain("for and on behalf of:");
    expect(agentPlain).toContain("{agent_1_name}");
    expect(agentPlain).toContain("{agent_2_designation}");
    const issuerText = xml.indexOf(">ISSUER</w:t>");
    expect(issuerText).toBeGreaterThan(-1);
    const issuerPara = xml.lastIndexOf("<w:p ", issuerText);
    const issuerHeading = xml.slice(issuerPara, issuerText + 800);
    expect(issuerHeading).toContain('<w:footnoteReference w:id="5"/>');
    expect(issuerHeading).toContain('w:line="276"');
    const issuerBlockEnd = xml.indexOf("{/issuer_signatories}");
    expect(xml.slice(issuerPara, issuerBlockEnd)).not.toContain("leftBrace");
    expect(xml.slice(issuerPara, issuerBlockEnd)).not.toContain("<w:drawing");
    expect(xml.slice(issuerPara, issuerBlockEnd)).not.toContain("Courier New");
    expect(xml.slice(issuerPara, issuerBlockEnd)).not.toContain("<w:pBdr>");
    const loopStart = xml.indexOf("{#issuer_signatories}");
    const loopEnd = xml.indexOf("{/issuer_signatories}");
    const tableInLoop = xml.indexOf("<w:tbl", loopStart);
    expect(loopStart).toBeGreaterThan(-1);
    expect(tableInLoop).toBeGreaterThan(loopStart);
    expect(tableInLoop).toBeLessThan(loopEnd);
    expect(xml).toContain("{#issuer_signatory_pages}");
    expect(xml).toContain("{@page_break}");
    const issuerTable = xml.slice(tableInLoop, xml.indexOf("</w:tbl>", tableInLoop));
    expect(issuerTable).not.toContain("Issuer's company stamp:");
    expect((issuerTable.match(/<w:tr\b/g) ?? []).length).toBe(6);
    const pagesLoopEnd = xml.indexOf("{/issuer_signatory_pages}");
    expect(pagesLoopEnd).toBeGreaterThan(loopEnd);
    const afterPages = xml.slice(pagesLoopEnd, xml.indexOf("SCHEDULE 1", pagesLoopEnd));
    expect(afterPages).toContain("Issuer's company stamp:");
    expect((afterPages.match(/Issuer's company stamp:/g) ?? []).length).toBe(1);
    expect(xml).toContain('<w:br w:type="page"/>');
    expect(runContaining(xml, "{facility_agreement_date}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{issuer_name}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{financing_limit_rm}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{investor_1_name}")).toMatch(/<w:t>\{investor_1_name\}<\/w:t>/);
    expect(runContaining(xml, "{agent_1_designation}")).toMatch(/<w:t>\{agent_1_designation\}<\/w:t>/);
    expect(runContaining(xml, "{investor_1_name}")).not.toMatch(/<w:t xml:space="preserve"> \{/);
    const investorNamePara = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].find((row) =>
      row[0].includes("{investor_1_designation}")
    )?.[0];
    const agentNamePara = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].find((row) =>
      row[0].includes("{agent_1_designation}")
    )?.[0];
    expect(paragraphPinsFaExecutionValueWrap(investorNamePara ?? "")).toBe(true);
    expect(paragraphPinsFaExecutionValueWrap(agentNamePara ?? "")).toBe(true);
    expect(
      paragraphPinsTableHangingLabelWrap(
        paragraphContaining(xml, "{witness_name}"),
        "Name of Witness",
        FA_ISSUER_WITNESS_COLON_TWIPS
      )
    ).toBe(true);
    expect(
      paragraphPinsTableHangingLabelWrap(
        paragraphContaining(xml, "{witness_nric}"),
        "NRIC",
        FA_ISSUER_WITNESS_COLON_TWIPS
      )
    ).toBe(true);
    expect(
      paragraphPinsTableHangingLabelWrap(
        paragraphContaining(xml, "{designation}"),
        "Designation",
        FA_ISSUER_SIGNATORY_COLON_TWIPS
      )
    ).toBe(true);
    expect(
      paragraphPinsTableHangingLabelWrap(
        paragraphContaining(xml, "{name}"),
        "Name",
        FA_ISSUER_SIGNATORY_COLON_TWIPS
      )
    ).toBe(true);
    const investorSlice = xml.slice(investorXml, agentXml);
    const mixedStrokePara = [...investorSlice.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].find(
      (row) => row[0].includes("Shoraka Suyula Platform Sdn. Bhd.") && row[0].includes("_________")
    )?.[0];
    expect(mixedStrokePara).toBeTruthy();
    expect(mixedStrokePara).not.toContain("Courier New");
    expect(mixedStrokePara).not.toContain("<w:pBdr>");
    expect(investorPlain).toContain("Shoraka Suyula Platform Sdn. Bhd.");
    expect(investorSlice).not.toContain("<w:tbl");
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
    expect(plain).toContain("Aisha Rahman");
    expect(plain).toContain("Chloe Lim");
    expect(plain).toContain("As prescribed in the Letter of Offer");
    expect(plain).not.toContain("{drawdown_fee}");
    expect(plain).not.toContain("{#issuer_signatories}");
    expect(plain).not.toContain("{#issuer_signatory_pages}");
    expect(plain).not.toContain("{@page_break}");
  });

  it("keeps two issuer pairs on one page and page-breaks after every two", () => {
    const two = renderedXml(createFacilityAgreementFixture());
    const twoIssuerAt = two.indexOf(">ISSUER</w:t>");
    const twoIssuer = two.slice(twoIssuerAt, two.indexOf("SCHEDULE 1", twoIssuerAt));
    expect((twoIssuer.match(/<w:br w:type="page"\/>/g) ?? []).length).toBe(1);
    expect((wordPlainText(twoIssuer).match(/Issuer's company stamp:/g) ?? []).length).toBe(1);

    const fourData = createFacilityAgreementFixture();
    fourData.issuer_signatories = [0, 1, 2, 3].map((index) => ({
      name: `Issuer Signer ${index}`,
      designation: "Director",
      witness_name: "Chloe Lim",
      witness_nric: "850101015555",
    }));
    const four = renderedXml(fourData);
    const fourIssuerAt = four.indexOf(">ISSUER</w:t>");
    const fourIssuer = four.slice(fourIssuerAt, four.indexOf("SCHEDULE 1", fourIssuerAt));
    expect(wordPlainText(fourIssuer)).toContain("Issuer Signer 0");
    expect(wordPlainText(fourIssuer)).toContain("Issuer Signer 3");
    expect((fourIssuer.match(/<w:br w:type="page"\/>/g) ?? []).length).toBe(2);
    const fourPlain = wordPlainText(fourIssuer);
    expect((fourPlain.match(/Issuer's company stamp:/g) ?? []).length).toBe(1);
    expect(fourPlain.indexOf("Issuer's company stamp:")).toBeGreaterThan(fourPlain.lastIndexOf("Issuer Signer 3"));
  });

  it("connects underscore signature strokes without hiding the glyphs", () => {
    const xml = renderedXml(createFacilityAgreementFixture());
    const { before } = splitFacilityAgreementXmlAtSchedule4(xml);
    const underscoreRuns = [...before.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)]
      .map((match) => match[0])
      .filter((run) => /^_{8,}$/.test(wordPlainText(run).trim()));

    expect(underscoreRuns.length).toBeGreaterThan(0);
    expect(underscoreRuns.every((run) => run.includes('<w:spacing w:val="-40"/>'))).toBe(true);
    expect(underscoreRuns.some((run) => run.includes('w:val="FFFFFF"'))).toBe(false);
    expect(underscoreRuns.some((run) => run.includes("<w:u "))).toBe(false);
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

  it("fills Schedule 9 Appendix 1 date and issuer particulars, leaving other utilisation forms untagged", () => {
    const zip = new PizZip(readFacilityAgreementTemplateBytes());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const plain = wordPlainText(xml);
    const scheduleStart = plain.indexOf("SCHEDULE 4");
    expect(scheduleStart).toBeGreaterThan(-1);
    const schedules = plain.slice(scheduleStart);
    const appendixStart = schedules.indexOf("APPENDIX 1");
    expect(appendixStart).toBeGreaterThan(-1);
    const beforeAppendix = schedules.slice(0, appendixStart);
    const appendix = schedules.slice(appendixStart);

    expect(schedules).toContain("SCHEDULE 9");
    expect(beforeAppendix).not.toMatch(/\{[#/]?[A-Za-z][A-Za-z0-9_]*\}/);
    expect(appendix).toContain("{facility_agreement_date}");
    expect(appendix).toContain(
      "{issuer_name} (Company No. {issuer_registration_number}) of {issuer_address}"
    );
    expect(appendix).toContain("Shariah compliant commodities as per the e-certificate attached");
    expect(appendix).toContain("The amount equivalent to the Principal Amount");
    expect(schedules).toContain("[ISSUER NAME]");
    expect(schedules).toContain("[Issuer’s Address]");
    expect(schedules).toContain("Issuer : [●]");
    expect(schedules).toContain("Facility: [●]");
    expect(schedules).toContain("[ISSUER]");

    expect(runContaining(xml, "{facility_agreement_date}")).toContain('w:val="yellow"');

    const data = createFacilityAgreementFixture();
    const rendered = wordPlainText(renderedXml(data));
    const renderedSchedules = rendered.slice(rendered.indexOf("SCHEDULE 4"));
    const renderedAppendix = renderedSchedules.slice(renderedSchedules.indexOf("APPENDIX 1"));
    expect(renderedAppendix).toContain(data.facility_agreement_date);
    expect(renderedAppendix).toContain(
      `${data.issuer_name} (Company No. ${data.issuer_registration_number}) of ${data.issuer_address}`
    );
    expect(renderedSchedules).toContain("[ISSUER NAME]");
    expect(renderedSchedules).toContain("Issuer : [●]");
  });

  it("does not restyle Schedules 4 to 9 signature strokes", () => {
    const template = new PizZip(readFacilityAgreementTemplateBytes()).file("word/document.xml")
      ?.asText() ?? "";
    const rendered = renderedXml(createFacilityAgreementFixture());
    const templateSchedules = splitFacilityAgreementXmlAtSchedule4(template).fromSchedule4;
    const renderedSchedules = splitFacilityAgreementXmlAtSchedule4(rendered).fromSchedule4;

    expect((renderedSchedules.match(/<w:spacing w:val="-40"\/>/g) ?? []).length).toBe(
      (templateSchedules.match(/<w:spacing w:val="-40"\/>/g) ?? []).length
    );
    expect((renderedSchedules.match(/<w:jc w:val="both"\/>/g) ?? []).length).toBe(
      (templateSchedules.match(/<w:jc w:val="both"\/>/g) ?? []).length
    );
    expect(renderedSchedules).toContain('<w:jc w:val="both"/>');
    expect(renderedSchedules).not.toContain('<w:jc w:val="left"/>');
  });
});
