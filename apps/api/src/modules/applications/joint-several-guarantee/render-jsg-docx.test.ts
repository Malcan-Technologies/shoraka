import PizZip from "pizzip";
import { createJsgFixture } from "./jsg-fixture";
import type { JsgMergeData } from "./jsg-merge.types";
import {
  readJsgTemplateBytes,
  renderJsgDocx,
  resolveJsgTemplatePath,
} from "./render-jsg-docx";
import {
  JSG_OPERATOR_WRAP_LEFT_TWIPS,
  paragraphPinsJsgOperatorValueWrap,
  paragraphPinsTableHangingLabelWrap,
} from "../../generated-documents/hanging-execution-label";
import { MERGE_EMPTY_DISPLAY } from "../../generated-documents/merge-visibility";

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

  it("keeps value tags, guarantor loops, and wet-ink operator lines without highlight", () => {
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
    expect(plain).toContain("{witness_name}");
    expect(plain).toContain("{witness_nric}");
    expect(plain).toContain("{operator_1_name}");
    expect(plain).toContain("{operator_2_designation}");
    expect(plain).toContain("OPERATOR");
    expect(xml).toContain("{@page_break}");
    expect(xml).toContain("{@individuals_page_break}");
    expect(xml).toContain("<w:cantSplit/>");
    expect(numbering).toContain('w:numId="20"');

    const operatorXmlSlice = xml.slice(xml.indexOf("OPERATOR"), xml.indexOf("SCHEDULE 1"));
    expect(operatorXmlSlice).toContain("Signed by its Attorney for and on behalf of");
    expect(operatorXmlSlice).toContain("in the presence of:-");
    expect(operatorXmlSlice).toContain("<w:tab");
    expect((operatorXmlSlice.match(/Signature of Witness/g) ?? []).length).toBe(1);
    expect((operatorXmlSlice.match(/\.{8,}/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((operatorXmlSlice.match(/Date:\s*_{8,}/g) ?? []).length).toBe(0);
    const operatorName1 = paragraphContaining(operatorXmlSlice, "{operator_1_name}");
    const operatorName2 = paragraphContaining(operatorXmlSlice, "{operator_2_name}");
    const operatorDesignation1 = paragraphContaining(operatorXmlSlice, "{operator_1_designation}");
    const operatorDesignation2 = paragraphContaining(operatorXmlSlice, "{operator_2_designation}");
    expect(operatorName1).toContain(`w:left="${JSG_OPERATOR_WRAP_LEFT_TWIPS}"`);
    expect(operatorName2).toContain(`w:left="${JSG_OPERATOR_WRAP_LEFT_TWIPS}"`);
    expect(paragraphPinsJsgOperatorValueWrap(operatorName1)).toBe(true);
    expect(paragraphPinsJsgOperatorValueWrap(operatorDesignation1)).toBe(true);
    expect(paragraphPinsJsgOperatorValueWrap(operatorDesignation2)).toBe(true);
    expect(operatorName1).not.toContain("w:firstLine=");
    expect(operatorName1).toContain('w:line="276"');
    expect(operatorName1).not.toContain("<w:b/>");
    expect(operatorName2).not.toContain("<w:b/>");
    expect(operatorDesignation2).not.toContain("MS Mincho");
    expect(paragraphPinsTableHangingLabelWrap(paragraphContaining(xml, "{nric}"), "NRIC No.")).toBe(true);
    expect(paragraphPinsTableHangingLabelWrap(paragraphContaining(xml, "{witness_name}"), "Full Name")).toBe(true);

    const linePara = paragraphContaining(xml, "{line}");
    expect(linePara).toContain('<w:numId w:val="20"/>');
    expect(linePara).toContain('<w:ilvl w:val="0"/>');
    expect(linePara).not.toContain("w:highlight");
    const repPara = paragraphContaining(xml, "{rep_line}");
    expect(repPara).toContain('<w:numId w:val="20"/>');
    expect(repPara).toContain('<w:ilvl w:val="1"/>');

    expect(runContaining(xml, "{guarantee_date}")).not.toContain("w:highlight");
    expect(runContaining(xml, "{issuer_name}")).not.toContain("w:highlight");
    expect(runContaining(xml, "{nric}")).not.toContain("w:highlight");
    expect(runContaining(xml, "{company_name}")).not.toContain("w:highlight");
    expect(runContaining(xml, "{facility_description}")).not.toContain("w:highlight");
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
    expect(plain).toContain("Aisha Rahman");
    expect(plain).toContain("Chloe Lim");
    expect(plain).not.toContain("{#guarantors_individual}");
    expect(plain).not.toContain("[Issuer");

    const execXml = xml.slice(xml.indexOf("EXECUTION PAGE"), xml.indexOf("OPERATOR"));
    const execPlain = wordPlainText(execXml);
    expect((execPlain.match(/The Guarantor\(s\)/g) ?? []).length).toBe(2);
    const firstAli = execXml.indexOf("Ali Bin Abu");
    const firstSiti = execXml.indexOf("Siti Binti Ahmad");
    const holdco = execXml.indexOf("HOLDCO ONE");
    expect(firstAli).toBeGreaterThanOrEqual(0);
    expect(firstSiti).toBeGreaterThan(firstAli);
    expect(holdco).toBeGreaterThan(firstSiti);
    expect(execXml.slice(firstAli, firstSiti)).not.toContain('<w:br w:type="page"/>');
    expect(execXml.slice(firstSiti, holdco)).toContain('<w:br w:type="page"/>');
    expect(xml.slice(xml.indexOf("EXECUTION PAGE")).match(/<w:br w:type="page"\/>/g)?.length).toBeGreaterThanOrEqual(
      3
    );
  });

  it("connects standalone underscore strokes and leaves dotted and Date lines untouched", () => {
    const xml = renderedXml(createJsgFixture());
    const runs = [...xml.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)].map((match) => match[0]);
    const underscoreRuns = runs.filter((run) => /^_{8,}$/.test(wordPlainText(run).trim()));
    const dottedRuns = runs.filter((run) => /^\.{8,}$/.test(wordPlainText(run).trim()));
    const dateRuns = runs.filter((run) => /^Date:\s*_{8,}$/i.test(wordPlainText(run).trim()));

    expect(dottedRuns.length).toBeGreaterThan(0);
    expect(dottedRuns.every((run) => !run.includes('<w:spacing w:val="-40"/>'))).toBe(true);
    expect(dateRuns.length).toBeGreaterThan(0);
    expect(dateRuns.every((run) => !run.includes('<w:spacing w:val="-40"/>'))).toBe(true);
    expect(
      underscoreRuns.every(
        (run) =>
          run.includes('<w:spacing w:val="-40"/>') &&
          !run.includes('w:val="FFFFFF"') &&
          !run.includes("<w:u ")
      )
    ).toBe(true);
  });

  it("prints N/A when scalars are empty", () => {
    const data = createJsgFixture();
    data.issuer_name = "";
    data.facility_description = "";
    const xml = renderedXml(data);
    const plain = wordPlainText(xml);
    expect(plain).toContain(MERGE_EMPTY_DISPLAY);
    expect(plain).not.toContain("{issuer_name}");
    expect(plain).not.toContain("{facility_description}");
  });

  it("omits the corporate execution block when there are no company guarantors", () => {
    const data = createJsgFixture();
    data.guarantors_corporate = [];
    const xml = renderedXml(data);
    const plain = wordPlainText(xml);
    expect(plain).toContain("Ali Bin Abu");
    expect(plain).not.toContain("For and on behalf of");
    expect(xml).not.toContain("{#has_corporate_guarantor}");
    const execXml = xml.slice(xml.indexOf("EXECUTION PAGE"), xml.indexOf("OPERATOR"));
    expect((wordPlainText(execXml).match(/The Guarantor\(s\)/g) ?? []).length).toBe(1);
    expect(
      execXml.slice(execXml.indexOf("Ali Bin Abu"), execXml.indexOf("Siti Binti Ahmad"))
    ).not.toContain('<w:br w:type="page"/>');
  });

  it("starts each corporate guarantor on a new page", () => {
    const data = createJsgFixture();
    data.guarantors_corporate = [
      ...data.guarantors_corporate,
      {
        name: "HOLDCO TWO SDN. BHD.",
        ssm: "654321-B",
        signatories: [{ name: "Aini Rahman", nric: "660101015555", capacity: "director" }],
      },
    ];
    const xml = renderedXml(data);
    const execXml = xml.slice(xml.indexOf("EXECUTION PAGE"), xml.indexOf("OPERATOR"));
    expect((wordPlainText(execXml).match(/The Guarantor\(s\)/g) ?? []).length).toBe(3);
    const holdcoOne = execXml.indexOf("HOLDCO ONE");
    const holdcoTwo = execXml.indexOf("HOLDCO TWO");
    expect(holdcoTwo).toBeGreaterThan(holdcoOne);
    expect(execXml.slice(holdcoOne, holdcoTwo)).toContain('<w:br w:type="page"/>');
  });
});
