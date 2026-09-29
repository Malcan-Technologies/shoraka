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
    expect(controller).toContain('"Application Reference"');
    expect(controller).toContain('"Application ID"');
    expect(controller).toContain('"Envelope Title"');
    expect(controller).toContain('"Envelope ID"');
    expect(controller).not.toMatch(/\.\.\.row\b/);
  });

  it("requires audit.external_acceptances.view on every route", () => {
    const guards = [...controller.matchAll(/router\.get\(\s*"[^"]+",\s*([^\n]+),\n/g)].map(
      (match) => match[1]
    );
    expect(guards).toEqual([
      'requirePermission("audit.external_acceptances.view")',
      'requirePermission("audit.external_acceptances.view")',
      'requirePermission("audit.external_acceptances.view")',
    ]);
    expect(controller).not.toContain("document_management.view");
  });
});
