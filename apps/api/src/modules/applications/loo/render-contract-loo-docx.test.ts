import PizZip from "pizzip";
import { createContractLooFixture } from "./contract-loo-fixture";
import { renderContractLooDocx, resolveContractLooTemplatePath } from "./render-contract-loo-docx";

describe("renderContractLooDocx", () => {
  it("resolves the tagged template file", () => {
    expect(resolveContractLooTemplatePath()).toMatch(/arf-contract-facility-loo\.docx$/);
  });

  it("renders a non-empty docx zip with substituted values", () => {
    const data = createContractLooFixture();
    data.issuer_name = "RENDERED_ISSUER_NAME_XYZ";
    const buffer = renderContractLooDocx(data);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);

    const zip = new PizZip(buffer);
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    expect(xml).toContain("RENDERED_ISSUER_NAME_XYZ");
    expect(xml).not.toContain("{issuer_name}");
  });
});
