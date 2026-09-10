import * as fs from "fs";
import * as path from "path";

describe("admin invoice offer campaign classification ownership", () => {
  const offerSource = fs.readFileSync(path.join(__dirname, "invoice-offer-panel.tsx"), "utf8");
  const reviewSource = fs.readFileSync(path.join(__dirname, "invoice-review-list.tsx"), "utf8");

  it("prefills Campaign Sector, Company category, and Sustainability from issuer invoice values", () => {
    expect(offerSource).toContain("resolveInvoiceCampaignSector(invoice)");
    expect(offerSource).toContain("resolveInvoiceCompanyCategory(invoice)");
    expect(offerSource).toContain("resolveInvoiceSustainabilityCategory(invoice)");
    expect(reviewSource).toContain("resolveInvoiceCampaignSector(inv)");
    expect(reviewSource).toContain("resolveInvoiceCompanyCategory(inv)");
    expect(reviewSource).toContain("resolveInvoiceSustainabilityCategory(inv)");
  });

  it("does not default Sustainability Category to 00 – None at first offer entry", () => {
    expect(offerSource).not.toContain('?? "NONE"');
    expect(reviewSource).not.toContain('?? "NONE"');
  });
});
