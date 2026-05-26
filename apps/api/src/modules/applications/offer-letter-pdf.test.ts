import { buildInvoiceOfferLetterTerms } from "./offer-letter-pdf";

describe("buildInvoiceOfferLetterTerms", () => {
  it("includes platform fee line with resolved percentage", async () => {
    const terms = buildInvoiceOfferLetterTerms("inv-123", {
      requested_amount: 10_000,
      offered_amount: 8_000,
      offered_ratio_percent: 80,
      offered_profit_rate_percent: 12,
      platform_fee_rate_percent: 2.5,
      expires_at: "2026-12-31T00:00:00.000Z",
    });
    expect(terms).toContainEqual({
      label: "Platform fee (at disbursement)",
      value: "2.5% of the funded amount, deducted from disbursement proceeds",
    });
  });

  it("defaults platform fee display to zero when omitted", async () => {
    const terms = buildInvoiceOfferLetterTerms("inv-456", {
      offered_amount: 1,
      offered_ratio_percent: 100,
      offered_profit_rate_percent: 0,
      expires_at: "2026-06-01T00:00:00.000Z",
    });
    expect(terms).toContainEqual({
      label: "Platform fee (at disbursement)",
      value: "0% of the funded amount, deducted from disbursement proceeds",
    });
  });

  it("includes facility fee terms for contract financing invoices", async () => {
    const terms = buildInvoiceOfferLetterTerms("inv-789", {
      offered_amount: 100_000,
      offered_ratio_percent: 80,
      offered_profit_rate_percent: 12,
      platform_fee_rate_percent: 3,
      facility_fee_rate_percent: 1,
      facility_fee_cap_amount: 1_000,
      expires_at: "2026-06-01T00:00:00.000Z",
    });

    expect(terms).toContainEqual({
      label: "Facility fee rate",
      value: "1% of each disbursed invoice financing amount",
    });
    expect(terms).toContainEqual({
      label: "Facility fee cap",
      value: "RM 1,000.00",
    });
  });
});
