import fs from "node:fs";
import path from "node:path";

describe("application related records canonical references", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "[productKey]/[id]/page.tsx"),
    "utf8"
  );

  it("shows canonical refs without appending raw CUIDs", () => {
    expect(source).toContain('label="Issuer Organization"');
    expect(source).toContain("formatNamedEntityDisplay");
    expect(source).toContain('label="Facility Reference"');
    expect(source).toContain("formatContractReference");
    expect(source).toContain('label="Note Reference"');
    expect(source).toContain("formatNoteReference");
    expect(source).toContain("orgHref(\"issuer\", app.issuer_organization_id)");
    expect(source).toContain("`/contracts/${encodeURIComponent(applicationContractId)}`");
    expect(source).toContain("`/notes/${encodeURIComponent(note.id)}`");
    expect(source).not.toContain('label="Facility ID"');
    expect(source).not.toContain('label="Note ID"');
    expect(source).not.toContain("${note.note_reference} (${note.id})");
    expect(source).not.toContain("${app.issuer_organization.name} (${app.issuer_organization_id})");
  });

  it("hides Facility Reference for standalone invoice applications", () => {
    expect(source).toContain("isInvoiceOnlyFinancingStructure");
    expect(source).toContain("{!isInvoiceOnly ? (");
    expect(source).toContain('label="Facility Reference"');
  });
});
