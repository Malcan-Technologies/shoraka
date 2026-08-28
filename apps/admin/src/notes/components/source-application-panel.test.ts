import fs from "node:fs";
import path from "node:path";

describe("SourceApplicationPanel canonical references", () => {
  const source = fs.readFileSync(path.join(__dirname, "source-application-panel.tsx"), "utf8");

  it("shows canonical references and keeps internal IDs for routing only", () => {
    expect(source).toContain('label="Application Reference"');
    expect(source).toContain('label="Invoice Reference"');
    expect(source).toContain('label="Facility Reference"');
    expect(source).toContain("formatApplicationReference");
    expect(source).toContain("formatInvoiceReference");
    expect(source).toContain("formatContractReference");
    expect(source).toContain("formatNamedEntityDisplay");
    expect(source).toContain("note.sourceApplicationId");
    expect(source).toContain("note.sourceInvoiceId");
    expect(source).toContain("linkage.contractHref");
    expect(source).toContain("orgHref(\"issuer\", note.issuerOrganizationId)");
    expect(source).not.toContain('label="Application ID"');
    expect(source).not.toContain('label="Facility ID"');
    expect(source).not.toContain("note.issuerName ? `${note.issuerName} (${note.issuerOrganizationId})`");
  });
});
