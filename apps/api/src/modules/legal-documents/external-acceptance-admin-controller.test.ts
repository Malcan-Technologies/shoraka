import fs from "node:fs";
import path from "node:path";

const controller = fs.readFileSync(
  path.join(__dirname, "external-acceptance-admin-controller.ts"),
  "utf8"
);

describe("legal external acceptance Admin export route", () => {
  it("registers /export before /:id so export is not treated as an id", () => {
    expect(controller.indexOf('"/export"')).toBeGreaterThan(-1);
    expect(controller.indexOf('"/export"')).toBeLessThan(controller.indexOf('"/:id"'));
  });

  it("enumerates CSV columns and never writes unmasked IC", () => {
    expect(controller).toContain("Masked IC");
    expect(controller).toContain("row.partyIcMasked");
    expect(controller).not.toContain("partyIcNumber");
    expect(controller).not.toContain("party_ic_number");
    expect(controller).not.toMatch(/\.\.\.row\b/);
  });

  it("requires document_management.view", () => {
    expect(controller).toContain('requirePermission("document_management.view")');
  });
});
