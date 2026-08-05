/**
 * Investment commit must not depend on SiteDocument PRODUCT_TERMS / RISK_DISCLOSURE.
 */
describe("note investment SiteDocument removal", () => {
  it("notes service commit path no longer references SiteDocument or product_terms_ref", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const source = fs.readFileSync(
      path.join(__dirname, "service.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/siteDocument/i);
    expect(source).not.toMatch(/PRODUCT_TERMS/);
    expect(source).not.toMatch(/RISK_DISCLOSURE/);
    expect(source).not.toMatch(/product_terms_ref/);
    expect(source).not.toMatch(/risk_disclosure_ref/);
  });

  it("prisma schema no longer defines SiteDocument or DocumentLog", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const schema = fs.readFileSync(
      path.join(__dirname, "../../../prisma/schema.prisma"),
      "utf8"
    );
    expect(schema).not.toMatch(/model SiteDocument/);
    expect(schema).not.toMatch(/model DocumentLog/);
    expect(schema).not.toMatch(/enum SiteDocumentType/);
    expect(schema).not.toMatch(/product_terms_ref/);
    expect(schema).not.toMatch(/risk_disclosure_ref/);
    expect(schema).toMatch(/model LegalDocument/);
    expect(schema).toMatch(/model LegalDocumentVersion/);
    expect(schema).toMatch(/model LegalDocumentAcceptance/);
  });
});
