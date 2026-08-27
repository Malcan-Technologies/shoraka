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

function count(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

/** Concatenate Word text nodes so merged values split across yellow runs still match. */
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
/** Hardcoded section breaks already in the 19 Aug Word file (Schedule / MoA / annex). */
const TEMPLATE_PAGE_BREAKS = 4;

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
    expect(xml).not.toContain("RM{financing_limit_rm}");
    expect(xml).toMatch(
      /<w:highlight w:val="yellow"\/>\s*<\/w:rPr>\s*<w:t>\{issuer_name\}<\/w:t>/
    );
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
  });

  it("renders three individual acknowledgement pages with one box each", () => {
    const data = createFacilityLoFixture();
    data.guarantors_corporate = [];
    data.guarantors_individual = [
      { name: "Guarantor Alpha", nric: "900101145678", line: "Guarantor Alpha (NRIC No. 900101145678)" },
      { name: "Guarantor Beta", nric: "880202085432", line: "Guarantor Beta (NRIC No. 880202085432)" },
      { name: "Guarantor Gamma", nric: "770303123456", line: "Guarantor Gamma (NRIC No. 770303123456)" },
    ];
    const xml = renderedXml(data);
    expect(xml).toContain("Guarantor Alpha");
    expect(xml).toContain("Guarantor Beta");
    expect(xml).toContain("Guarantor Gamma");
    expect(count(xml, "ACKNOWLEDGEMENT AND CONSENT BY GUARANTORS")).toBe(3);
    expect(count(xml, SIG_LINE)).toBe(3);
    expect(count(xml, 'w:type="page"')).toBe(TEMPLATE_PAGE_BREAKS + 2);
    expect(xml).not.toContain("For and on behalf of HOLDCO");
  });

  it("renders one corporate page with two boxes for a two-signatory company", () => {
    const data = createFacilityLoFixture();
    data.guarantors_individual = [];
    data.guarantors_corporate = [
      {
        name: "HoldCo Two Sig Sdn Bhd",
        ssm: "111111-X",
        signatories: [{ name: "Nora" }, { name: "Farid" }],
      },
    ];
    const xml = renderedXml(data);
    const text = wordPlainText(xml);
    expect(xml).toContain("HoldCo Two Sig Sdn Bhd");
    expect(xml).toContain("Nora");
    expect(xml).toContain("Farid");
    expect(count(xml, "ACKNOWLEDGEMENT AND CONSENT BY GUARANTORS")).toBe(1);
    expect(count(text, "For and on behalf of HoldCo Two Sig Sdn Bhd")).toBe(1);
    expect(count(xml, SIG_LINE)).toBe(2);
    expect(count(xml, 'w:type="page"')).toBe(TEMPLATE_PAGE_BREAKS);
  });

  it("renders two corporate pages for a five-signatory company with the heading only on the first", () => {
    const data = createFacilityLoFixture();
    data.guarantors_individual = [];
    data.guarantors_corporate = [
      {
        name: "HoldCo Five Sig Sdn Bhd",
        ssm: "222222-U",
        signatories: [
          { name: "Aini" },
          { name: "Bala" },
          { name: "Chen" },
          { name: "Devi" },
          { name: "Ehsan" },
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
    expect(xml).not.toContain("HOLDCO ONE");
    expect(xml).not.toContain("HOLDCO TWO");
    expect(xml).not.toContain("{#has_corporate_guarantor}");
    expect(xml).not.toContain("{company_name}");
  });

  it("highlights merged values in yellow like the clean-copy placeholders", () => {
    const data = createFacilityLoFixture();
    data.issuer_name = "YELLOW_ISSUER_NAME_XYZ";
    const xml = renderedXml(data);
    const run = xml.match(
      /<w:r>[\s\S]*?YELLOW_ISSUER_NAME_XYZ[\s\S]*?<\/w:r>/
    )?.[0];
    expect(run).toContain('<w:highlight w:val="yellow"/>');
  });

  it("prints the merge tag when a field has no source value", () => {
    const data = createFacilityLoFixture();
    data.tenure_days = "";
    data.payment_period_days = "";
    const xml = renderedXml(data);
    expect(xml).toContain("{tenure_days}");
    expect(xml).toContain("{payment_period_days}");
    const tenureRun = xml.match(/<w:r>[\s\S]*?\{tenure_days\}[\s\S]*?<\/w:r>/)?.[0];
    expect(tenureRun).toContain('<w:highlight w:val="yellow"/>');
  });
});
