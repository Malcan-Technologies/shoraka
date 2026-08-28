import PizZip from "pizzip";
import { createFacilityLoFixture } from "./facility-lo-fixture";
import { FACILITY_LO_CHECKBOX_TICKED } from "./facility-lo-merge.types";
import {
  renderFacilityLoDocx,
  readFacilityLoTemplateBytes,
  resolveFacilityLoTemplatePath,
} from "./render-facility-lo-docx";
import type { ContractFacilityLoMergeData } from "./facility-lo-merge.types";

function renderedXml(data: ContractFacilityLoMergeData): string {
  const zip = new PizZip(renderFacilityLoDocx(data));
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

function emptyParagraphsBetween(xml: string, startNeedle: string, endNeedle: string): number {
  const start = xml.indexOf(startNeedle);
  const end = xml.indexOf(endNeedle, start + startNeedle.length);
  if (start < 0 || end < 0) return -1;
  const slice = xml.slice(start + startNeedle.length, end);
  const paras = slice.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
  return paras.filter((p) => !/<w:t\b/.test(p)).length;
}

function emptyParagraphsAfterLast(xml: string, startNeedle: string, endNeedle: string): number {
  const start = xml.lastIndexOf(startNeedle);
  const end = xml.indexOf(endNeedle, start + startNeedle.length);
  if (start < 0 || end < 0) return -1;
  const slice = xml.slice(start + startNeedle.length, end);
  const paras = slice.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
  return paras.filter((p) => !/<w:t\b/.test(p)).length;
}

function count(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

/** Concatenate Word text nodes so values split across runs still match. */
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

const SIG_LINE = "______________________________";
/** Native section breaks in the tagged 19 Aug file, including the Annexure break. */
const TEMPLATE_PAGE_BREAKS = 5;

describe("renderFacilityLoDocx", () => {
  it("resolves the tagged template file", () => {
    expect(resolveFacilityLoTemplatePath()).toMatch(/arf-contract-facility-lo\.docx$/);
  });

  it("keeps five Word tables in the tagged template", () => {
    const zip = new PizZip(readFacilityLoTemplateBytes());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    expect((xml.match(/<w:tbl\b/g) ?? []).length).toBe(5);
    expect(xml).toContain("{part_a_checkbox}");
    expect(xml).toContain("{#corporate_guarantor_pages}");
    expect(xml).toContain("{#finance_documents_guarantors}");
    expect(xml).toContain("{left_name}");
    expect(xml).not.toContain("{left}");
    expect(xml).not.toContain("{right}");
    expect(xml).not.toContain("RM{financing_limit_rm}");
    expect(xml).not.toContain("{moa_authorised_signatory_names}");
    const linePara = paragraphContaining(xml, "{line}");
    expect(linePara).toContain('<w:numId w:val="4"/>');
    expect(linePara).toContain('<w:ilvl w:val="0"/>');
    expect(linePara).not.toContain('<w:numId w:val="3"/>');
    expect(linePara).toContain('w:val="yellow"');
    const repPara = paragraphContaining(xml, "{rep_line}");
    expect(repPara).toContain('<w:numId w:val="4"/>');
    expect(repPara).toContain('<w:ilvl w:val="1"/>');
    expect(emptyParagraphsAfterLast(xml, "{company_ssm}", "{#signatory_rows}")).toBe(4);
    expect(emptyParagraphsBetween(xml, "Date: ______________________", SIG_LINE)).toBe(2);
    expect(xml).toContain('w:val="yellow"');
    expect(runContaining(xml, "{issuer_name}")).toContain('w:val="yellow"');
  });

  it("renders a non-empty docx zip with substituted values and a Part A tick", () => {
    const data = createFacilityLoFixture();
    data.issuer_name = "RENDERED_ISSUER_NAME_XYZ";
    const xml = renderedXml(data);
    expect(xml).toContain("RENDERED_ISSUER_NAME_XYZ");
    expect(xml).toContain("Ali Bin Abu");
    expect(xml).toContain(FACILITY_LO_CHECKBOX_TICKED);
    expect(xml).not.toContain("{issuer_name}");
    expect(xml).not.toContain("RMRM");
    expect(xml).toContain("RM 1,000,000.00");
    expect(runContaining(xml, "RENDERED_ISSUER_NAME_XYZ")).toContain('w:val="yellow"');
    expect(runContaining(xml, "Ali Bin Abu")).toContain('w:val="yellow"');
  });

  it("lists individuals and nested corporate representatives in Finance Documents order", () => {
    const data = createFacilityLoFixture();
    data.guarantors_individual = [
      { name: "Ali", nric: "900101145678", line: "Ali (NRIC No. 900101145678)" },
    ];
    data.guarantors_corporate = [
      {
        name: "HoldCo",
        ssm: "111111-X",
        signatories: [{ name: "Nora", nric: "880101015555", capacity: "director" }],
      },
    ];
    data.finance_documents_guarantors = [
      { line: "Ali (NRIC No. 900101145678)", representatives: [] },
      {
        line: "HoldCo (Registration No. 111111-X)",
        representatives: [{ rep_line: "Nora (NRIC No. 880101015555)" }],
      },
    ];
    const xml = renderedXml(data);
    const text = wordPlainText(xml);
    expect(text).toContain("Ali (NRIC No. 900101145678)");
    expect(text).toContain("HoldCo (Registration No. 111111-X)");
    expect(text).toContain("Nora (NRIC No. 880101015555)");
    const entityPara = paragraphContaining(xml, "HoldCo (Registration No. 111111-X)");
    expect(entityPara).toContain('<w:ilvl w:val="0"/>');
    expect(entityPara).toContain('<w:numId w:val="4"/>');
    const nestedPara = paragraphContaining(xml, "Nora (NRIC No. 880101015555)");
    expect(nestedPara).toContain('<w:ilvl w:val="1"/>');
    expect(nestedPara).toContain('<w:numId w:val="4"/>');
  });

  it("renders three individual acknowledgement pages with one box each", () => {
    const data = createFacilityLoFixture();
    data.guarantors_corporate = [];
    data.finance_documents_guarantors = [];
    data.guarantors_individual = [
      { name: "Guarantor Alpha", nric: "900101145678", line: "Guarantor Alpha (NRIC No. 900101145678)" },
      { name: "Guarantor Beta", nric: "880202085432", line: "Guarantor Beta (NRIC No. 880202085432)" },
      { name: "Guarantor Gamma", nric: "770303123456", line: "Guarantor Gamma (NRIC No. 770303123456)" },
    ];
    const xml = renderedXml(data);
    const text = wordPlainText(xml);
    expect(xml).toContain("Guarantor Alpha");
    expect(xml).toContain("Guarantor Beta");
    expect(xml).toContain("Guarantor Gamma");
    expect(text).toContain("Letter of Offer dated 19 August 2026");
    expect(count(xml, "ACKNOWLEDGEMENT AND CONSENT BY GUARANTORS")).toBe(3);
    expect(count(xml, SIG_LINE)).toBe(3);
    expect(count(xml, 'w:type="page"')).toBe(TEMPLATE_PAGE_BREAKS + 2);
    expect(xml).not.toContain("For and on behalf of HOLDCO");
  });

  it("renders one corporate page with two boxes for a two-signatory company", () => {
    const data = createFacilityLoFixture();
    data.guarantors_individual = [];
    data.finance_documents_guarantors = [];
    data.guarantors_corporate = [
      {
        name: "HoldCo Two Sig Sdn Bhd",
        ssm: "111111-X",
        signatories: [
          { name: "Nora", nric: "880101015555", capacity: "director" },
          { name: "Farid", nric: "770202025555", capacity: "director" },
        ],
      },
    ];
    const xml = renderedXml(data);
    const text = wordPlainText(xml);
    expect(xml).toContain("HoldCo Two Sig Sdn Bhd");
    expect(xml).toContain("Nora");
    expect(xml).toContain("Farid");
    expect(count(xml, "ACKNOWLEDGEMENT AND CONSENT BY GUARANTORS")).toBe(1);
    expect(count(text, "For and on behalf of HoldCo Two Sig Sdn Bhd")).toBe(1);
    expect(text).toContain("111111-X");
    expect(count(xml, SIG_LINE)).toBe(2);
    expect(count(xml, 'w:type="page"')).toBe(TEMPLATE_PAGE_BREAKS);
    expect(xml).not.toContain("{left_name}");
    expect(xml).not.toContain("{right_name}");
    expect(xml).not.toContain("{left}");
    expect(xml).not.toContain("{right}");
  });

  it("puts the signature line before the printed signatory name", () => {
    const data = createFacilityLoFixture();
    data.guarantors_individual = [];
    data.finance_documents_guarantors = [];
    data.guarantors_corporate = [
      {
        name: "HoldCo Two Sig Sdn Bhd",
        ssm: "111111-X",
        signatories: [{ name: "NoraOnly", nric: "880101015555", capacity: "director" }],
      },
    ];
    const text = wordPlainText(renderedXml(data));
    const ackStart = text.indexOf("For and on behalf of HoldCo Two Sig Sdn Bhd");
    expect(ackStart).toBeGreaterThan(-1);
    const ack = text.slice(ackStart);
    const lineAt = ack.indexOf(SIG_LINE);
    const nameAt = ack.indexOf("NoraOnly");
    expect(lineAt).toBeGreaterThan(-1);
    expect(nameAt).toBeGreaterThan(lineAt);
  });

  it("renders two corporate pages for a five-signatory company with the heading only on the first", () => {
    const data = createFacilityLoFixture();
    data.guarantors_individual = [];
    data.finance_documents_guarantors = [];
    data.guarantors_corporate = [
      {
        name: "HoldCo Five Sig Sdn Bhd",
        ssm: "222222-U",
        signatories: [
          { name: "Aini", nric: "", capacity: "director" },
          { name: "Bala", nric: "", capacity: "director" },
          { name: "Chen", nric: "", capacity: "director" },
          { name: "Devi", nric: "", capacity: "director" },
          { name: "Ehsan", nric: "", capacity: "director" },
        ],
      },
    ];
    const xml = renderedXml(data);
    const text = wordPlainText(xml);
    expect(count(xml, "ACKNOWLEDGEMENT AND CONSENT BY GUARANTORS")).toBe(1);
    expect(count(text, "For and on behalf of HoldCo Five Sig Sdn Bhd")).toBe(2);
    expect(xml).toContain("HoldCo Five Sig Sdn Bhd");
    expect(count(xml, SIG_LINE)).toBe(5);
    expect(xml).toContain("Ehsan");
    expect(count(xml, 'w:type="page"')).toBe(TEMPLATE_PAGE_BREAKS + 1);
  });

  it("omits the corporate acknowledgement when there are no corporate guarantors", () => {
    const data = createFacilityLoFixture();
    data.guarantors_corporate = [];
    const xml = renderedXml(data);
    expect(xml).not.toContain("For and on behalf of HOLDCO");
    expect(xml).not.toContain("{#has_corporate_guarantor}");
    expect(xml).not.toContain("{company_name}");
    expect(xml).toContain("HOLDCO ONE");
    expect(xml).toContain("HOLDCO TWO");
  });

  it("uses the same offer validity phrase in both acceptance clauses", () => {
    const data = createFacilityLoFixture();
    data.offer_validity_phrase = "fourteen (14) days";
    const text = wordPlainText(renderedXml(data));
    expect(count(text, "fourteen (14) days")).toBeGreaterThanOrEqual(2);
  });

  it("prints visible merge tags and yellow highlight when a field has no data", () => {
    const data = createFacilityLoFixture();
    data.grace_period_days = "";
    data.finance_documents_guarantors = [];
    data.guarantors_individual = [];
    data.guarantors_corporate = [];
    const xml = renderedXml(data);
    const text = wordPlainText(xml);
    expect(text).toContain("{grace_period_days}");
    expect(text).toContain("[INSERT NAME] (NRIC No. [INSERT])");
    expect(runContaining(xml, "{grace_period_days}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "[INSERT NAME] (NRIC No. [INSERT])")).toContain('w:val="yellow"');
  });

  it("does not leave unresolved merge tags when fixture data is complete", () => {
    const xml = renderedXml(createFacilityLoFixture());
    expect(xml).not.toMatch(/\{[a-z][a-z0-9_]*\}/);
    expect(xml).toContain('w:val="yellow"');
  });
});
