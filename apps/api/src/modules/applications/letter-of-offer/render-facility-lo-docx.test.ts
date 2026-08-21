import PizZip from "pizzip";
import { createFacilityLoFixture } from "./facility-lo-fixture";
import { renderFacilityLoDocx, readFacilityLoTemplateBytes, resolveFacilityLoTemplatePath } from "./render-facility-lo-docx";

describe("renderFacilityLoDocx", () => {
  it("resolves the tagged template file", () => {
    expect(resolveFacilityLoTemplatePath()).toMatch(/arf-contract-facility-lo\.docx$/);
  });

  it("keeps all five Word tables in the tagged template", () => {
    const templatePath = resolveFacilityLoTemplatePath();
    const zip = new PizZip(readFacilityLoTemplateBytes());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    expect((xml.match(/<w:tbl\b/g) ?? []).length).toBe(5);
    expect(templatePath).toContain("arf-contract-facility-lo.docx");
  });

  it("renders a non-empty docx zip with substituted values", () => {
    const data = createFacilityLoFixture();
    data.issuer_name = "RENDERED_ISSUER_NAME_XYZ";
    data.guarantors_individual = [
      { name: "Guarantor Alpha", nric: "900101145678", line: "Guarantor Alpha (NRIC No. 900101145678)" },
    ];
    const buffer = renderFacilityLoDocx(data);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);

    const zip = new PizZip(buffer);
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    expect(xml).toContain("RENDERED_ISSUER_NAME_XYZ");
    expect(xml).toContain("Guarantor Alpha");
    expect(xml).not.toContain("{issuer_name}");
    expect(xml).not.toContain("{guarantor_1_name}");
    // Fixture has no corporate guarantor — corporate ack table is omitted by {#has_corporate_guarantor}
    expect((xml.match(/<w:tbl\b/g) ?? []).length).toBe(4);
  });

  it("keeps all schedule tables when a corporate guarantor is present", () => {
    const data = createFacilityLoFixture();
    data.corporate_guarantor_name = "HoldCo Sdn Bhd";
    data.corporate_guarantor_ssm = "999999-X";
    const buffer = renderFacilityLoDocx(data);
    const zip = new PizZip(buffer);
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    expect((xml.match(/<w:tbl\b/g) ?? []).length).toBe(5);
    expect(xml).toContain("HoldCo Sdn Bhd");
  });
});
