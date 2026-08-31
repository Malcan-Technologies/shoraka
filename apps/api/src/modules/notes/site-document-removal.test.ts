/**
 * Investment commit must not depend on SiteDocument PRODUCT_TERMS / RISK_DISCLOSURE.
 * Active invest acknowledgement is Prospectus-only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("note investment SiteDocument removal", () => {
  const notesDir = __dirname;
  const serviceSource = readFileSync(join(notesDir, "service.ts"), "utf8");
  const schemasSource = readFileSync(join(notesDir, "schemas.ts"), "utf8");
  const investorInvestDialog = readFileSync(
    join(notesDir, "../../../../investor/src/marketplace/marketplace-invest-dialogs.tsx"),
    "utf8"
  );
  const prospectusFooter = readFileSync(
    join(notesDir, "prospectus/prospectus-footer.html.ts"),
    "utf8"
  );

  it("notes service commit path no longer references SiteDocument or product_terms_ref", () => {
    expect(serviceSource).not.toMatch(/siteDocument/i);
    expect(serviceSource).not.toMatch(/PRODUCT_TERMS/);
    expect(serviceSource).not.toMatch(/RISK_DISCLOSURE/);
    expect(serviceSource).not.toMatch(/product_terms_ref/);
    expect(serviceSource).not.toMatch(/risk_disclosure_ref/);
    expect(serviceSource).not.toMatch(/productTermsRef/);
    expect(serviceSource).not.toMatch(/riskDisclosureRef/);
  });

  it("PROSPECTUS_ACK_REQUIRED message mentions Prospectus only", () => {
    expect(serviceSource).toMatch(
      /"Confirm that you have reviewed the Prospectus\."/
    );
    expect(serviceSource).not.toMatch(
      /Confirm that you have reviewed the Prospectus, Product Terms/
    );
    expect(serviceSource).toMatch(/prospectusAcknowledged !== true/);
  });

  it("createInvestment schema comment and field are prospectus-only", () => {
    expect(schemasSource).toMatch(
      /\/\*\* Required acknowledgement that the Prospectus was reviewed\. \*\//
    );
    expect(schemasSource).toMatch(/prospectusAcknowledged:\s*z\.literal\(true\)/);
    expect(schemasSource).not.toMatch(/Product Terms/);
    expect(schemasSource).not.toMatch(/Risk Disclosure/);
    expect(schemasSource).not.toMatch(/product_terms_ref/);
    expect(schemasSource).not.toMatch(/risk_disclosure_ref/);
  });

  it("investor invest dialog shows Prospectus acknowledgement only", () => {
    expect(investorInvestDialog).toMatch(
      /I(?:'|\&apos;)ve read the[\s\S]*prospectus[\s\S]*ready to continue/i
    );
    expect(investorInvestDialog).not.toMatch(/Product Terms/);
    expect(investorInvestDialog).not.toMatch(/Risk Disclosure Statement/);
    expect(investorInvestDialog).not.toMatch(/href="\/profile\?tab=documents"/);
  });

  it("marketplace commit hook still sends prospectusAcknowledged only", () => {
    const hook = readFileSync(
      join(notesDir, "../../../../investor/src/investments/hooks/use-marketplace-notes.ts"),
      "utf8"
    );
    expect(hook).toMatch(/prospectusAcknowledged:\s*true/);
    expect(hook).not.toMatch(/productTerms/);
    expect(hook).not.toMatch(/riskDisclosure/);
    expect(hook).not.toMatch(/PRODUCT_TERMS/);
    expect(hook).not.toMatch(/RISK_DISCLOSURE/);
  });

  it("prisma schema no longer defines SiteDocument or DocumentLog", () => {
    const schema = readFileSync(
      join(notesDir, "../../../prisma/schema.prisma"),
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

  it("prospectus footer Product Terms / Risk Disclosure wording remains unchanged", () => {
    expect(prospectusFooter).toContain(
      "Investors are advised to read and understand the Product Terms and Risk Disclosure Statement before investing."
    );
  });
});
