import * as fs from "fs";
import * as path from "path";

describe("admin invoice campaign classification is issuer-owned", () => {
  const offerSource = fs.readFileSync(path.join(__dirname, "invoice-offer-panel.tsx"), "utf8");
  const reviewSource = fs.readFileSync(path.join(__dirname, "invoice-review-list.tsx"), "utf8");
  const invoiceSectionSource = fs.readFileSync(
    path.join(__dirname, "application-review/sections/invoice-section.tsx"),
    "utf8"
  );
  const stackedFieldsSource = fs.readFileSync(
    path.join(__dirname, "application-review/sections/invoice-stacked-fields.tsx"),
    "utf8"
  );
  /** Pure formatters shared by live InvoiceStackedFields and the resubmit comparison projection. */
  const offerFormatSource = fs.readFileSync(
    path.join(__dirname, "../lib/resubmit-comparison/offer-acceptance-format.ts"),
    "utf8"
  );
  /** Resubmit comparison rows for the Offer & acceptance invoice stages. */
  const comparisonProjectionSource = fs.readFileSync(
    path.join(__dirname, "../lib/resubmit-comparison/offer-acceptance-projection.ts"),
    "utf8"
  );

  it("shows Company Category, Campaign Sector, and Sustainability as submitted values", () => {
    // Live invoice review renders InvoiceStackedFields, which prints the submitted labels.
    expect(invoiceSectionSource).toContain("<InvoiceStackedFields");
    expect(stackedFieldsSource).toContain("invoiceSubmittedCompanyCategoryLabel(invoice)");
    expect(stackedFieldsSource).toContain("invoiceSubmittedCampaignSectorLabel(invoice)");
    expect(stackedFieldsSource).toContain("invoiceSubmittedSustainabilityCategoryLabel(invoice)");
    expect(stackedFieldsSource).toContain("SC_MONTHLY_CAMPAIGN.companyCategory.label");
    expect(stackedFieldsSource).toContain("SC_MONTHLY_CAMPAIGN.campaignSector.label");
    expect(stackedFieldsSource).toContain("SC_MONTHLY_CAMPAIGN.sustainabilityCategory.label");
    expect(stackedFieldsSource).toContain("aria-label={SC_MONTHLY_CAMPAIGN.companyCategory.label}");
    // Resubmit comparison rows use the same labels and formatters.
    expect(comparisonProjectionSource).toContain("SC_MONTHLY_CAMPAIGN.companyCategory.label");
    expect(comparisonProjectionSource).toContain("SC_MONTHLY_CAMPAIGN.campaignSector.label");
    expect(comparisonProjectionSource).toContain("SC_MONTHLY_CAMPAIGN.sustainabilityCategory.label");
    expect(reviewSource).toContain('aria-label="Company category"');
    expect(reviewSource).toContain("SC_MONTHLY_CAMPAIGN.campaignSector.label");
    expect(reviewSource).toContain("SC_MONTHLY_CAMPAIGN.sustainabilityCategory.label");
  });

  it("does not let admin edit Company Category, Campaign Sector, or Sustainability", () => {
    expect(offerSource).not.toContain("setCompanyCategory");
    expect(offerSource).not.toContain("setCampaignSector");
    expect(offerSource).not.toContain("setSustainabilityCategory");
    expect(reviewSource).not.toContain("setCompanyCategoryByInvoiceId");
    expect(reviewSource).not.toContain("setCampaignSectorByInvoiceId");
    expect(reviewSource).not.toContain("setSustainabilityCategoryByInvoiceId");
    expect(offerSource).not.toContain("<SelectTrigger aria-label=\"Company category\"");
    expect(offerSource).not.toContain("<SelectTrigger aria-label={SC_MONTHLY_CAMPAIGN.campaignSector.label}");
    expect(offerSource).not.toContain(
      "<SelectTrigger aria-label={SC_MONTHLY_CAMPAIGN.sustainabilityCategory.label}"
    );
    expect(reviewSource).not.toContain("SC_COMPANY_CATEGORIES.map");
    expect(reviewSource).not.toContain("SC_CAMPAIGN_SECTORS.map");
    expect(reviewSource).not.toContain("SC_SUSTAINABILITY_CATEGORIES.map");
    expect(invoiceSectionSource).not.toContain("<Select");
  });

  it("reads classification from issuer invoice.details, not an admin edit API", () => {
    expect(offerSource).toContain("parseInvoiceOfferCompanyCategory(invoice.details)");
    expect(offerSource).toContain("parseInvoiceOfferCampaignSector(invoice.details)");
    expect(offerSource).toContain("parseInvoiceOfferSustainabilityCategory(invoice.details)");
    expect(reviewSource).toContain("parseInvoiceOfferCompanyCategory(inv.details)");
    expect(reviewSource).toContain("parseInvoiceOfferCampaignSector(inv.details)");
    expect(reviewSource).toContain("parseInvoiceOfferSustainabilityCategory(inv.details)");
    expect(stackedFieldsSource).toContain("@/lib/resubmit-comparison/offer-acceptance-format");
    expect(offerFormatSource).toContain("parseInvoiceOfferCompanyCategory(invoice?.details)");
    expect(offerFormatSource).toContain("parseInvoiceOfferCampaignSector(invoice?.details)");
    expect(offerFormatSource).toContain("parseInvoiceOfferSustainabilityCategory(invoice?.details)");
  });

  it("does not default Sustainability Category to 00 – None at first offer entry", () => {
    expect(offerSource).not.toContain('?? "NONE"');
    expect(reviewSource).not.toContain('?? "NONE"');
  });

  it("reuses the existing Request Amendment action on invoice review", () => {
    expect(invoiceSectionSource).toContain("onRequestAmendment={onRequestAmendmentItem}");
    expect(invoiceSectionSource).not.toContain("Correct classification");
    expect(invoiceSectionSource).not.toContain("requestCorrection");
  });

  it("shows corrected issuer values in the existing resubmit comparison", () => {
    expect(comparisonProjectionSource).toContain("text(b, invoiceSubmittedCompanyCategoryLabel)");
    expect(comparisonProjectionSource).toContain("text(a, invoiceSubmittedCompanyCategoryLabel)");
    expect(comparisonProjectionSource).toContain("text(b, invoiceSubmittedCampaignSectorLabel)");
    expect(comparisonProjectionSource).toContain("text(a, invoiceSubmittedSustainabilityCategoryLabel)");
  });
});
