import {
  UTILISATION_OFFER_TERMS_TITLE,
} from "@cashsouk/types";
import {
  buildContractOfferLetterTerms,
  buildInvoiceOfferLetterDto,
  buildInvoiceOfferLetterTerms,
  generateContractOfferLetterBuffer,
  generateGuarantorAgreementPlaceholderBuffer,
  invoiceOfferLetterKindForContract,
  invoiceOfferLetterPresentation,
} from "./offer-letter-pdf";

describe("buildContractOfferLetterTerms", () => {
  it("shows exact snapshot upfront and remaining drawdown collection amounts", () => {
    const terms = buildContractOfferLetterTerms("CON-ARF-202608-K71", {
      requested_facility: 200_000,
      offered_facility: 150_000,
      facility_fee_rate_percent: 1,
      facility_fee_upfront_collect_amount: 400,
    });
    expect(terms).toContainEqual({ label: "Facility fee rate", value: "1%" });
    expect(terms).toContainEqual({ label: "Facility fee total", value: "RM 1,500.00" });
    expect(terms).toContainEqual({
      label: "Upfront facility fee",
      value: "RM 400.00 is payable by gateway after you accept this facility offer.",
    });
    expect(terms).toContainEqual({
      label: "Remaining facility fee",
      value: "RM 1,100.00 is intended for collection from later invoice drawdowns.",
    });
    expect(terms.map((term) => term.value).join(" ")).not.toMatch(/progressively|due in full/i);
    expect(terms[0]).toEqual({
      label: "CashSouk Reference",
      value: "CON-ARF-202608-K71",
    });
  });

  it("says no upfront gateway payment is required when the snapshot upfront is RM0", () => {
    const terms = buildContractOfferLetterTerms("con-0", {
      requested_facility: 150_000,
      offered_facility: 150_000,
      facility_fee_rate_percent: 1,
      facility_fee_upfront_collect_amount: 0,
    });
    expect(terms).toContainEqual({ label: "Facility fee total", value: "RM 1,500.00" });
    expect(terms).toContainEqual({
      label: "Upfront facility fee",
      value: "No upfront gateway payment is required.",
    });
    expect(terms).toContainEqual({
      label: "Remaining facility fee",
      value: "RM 1,500.00 is intended for collection from later invoice drawdowns.",
    });
    expect(terms.map((term) => term.value).join(" ")).not.toMatch(/due in full/i);
  });

  it("makes a 0% facility fee explicit with a zero RM total and no upfront payment", () => {
    const terms = buildContractOfferLetterTerms("con-0-rate", {
      requested_facility: 150_000,
      offered_facility: 150_000,
      facility_fee_rate_percent: 0,
    });
    expect(terms).toContainEqual({ label: "Facility fee rate", value: "0%" });
    expect(terms).toContainEqual({ label: "Facility fee total", value: "RM 0.00" });
    expect(terms).toContainEqual({
      label: "Upfront facility fee",
      value: "No upfront gateway payment is required.",
    });
  });

  it("treats an omitted facility fee rate as 0%", () => {
    const terms = buildContractOfferLetterTerms("con-omit", {
      offered_facility: 100_000,
    });
    expect(terms).toContainEqual({ label: "Facility fee rate", value: "0%" });
    expect(terms).toContainEqual({ label: "Facility fee total", value: "RM 0.00" });
    expect(terms).toContainEqual({
      label: "Upfront facility fee",
      value: "No upfront gateway payment is required.",
    });
  });
});

describe("buildInvoiceOfferLetterDto", () => {
  it("carries the frozen v1 schedule from offer_details and ignores contract progressive terms", () => {
    const dto = buildInvoiceOfferLetterDto(
      {
        requested_amount: 100_000,
        offered_amount: 80_000,
        offered_ratio_percent: 80,
        offered_profit_rate_percent: 12,
        financing_tenure_days: 90,
        platform_fee_rate_percent: 3,
        fee_schedule_version: 1,
        facility_fee_collect_amount: 800,
        additional_fees: [
          { name: "Legal fee", kind: "amount", value: 500 },
          { name: "Arrangement", kind: "percent_of_funded", value: 1 },
        ],
      },
      {
        facility_fee_rate_percent: 1,
        approved_facility: 200_000,
      }
    );
    expect(dto.fee_schedule_version).toBe(1);
    expect(dto.facility_fee_collect_amount).toBe(800);
    expect(dto.additional_fees).toEqual([
      { name: "Legal fee", kind: "amount", value: 500 },
      { name: "Arrangement", kind: "percent_of_funded", value: 1 },
    ]);
    expect(dto.facility_fee_rate_percent).toBeUndefined();
    expect(dto.facility_fee_cap_amount).toBeUndefined();
    expect(dto.platform_fee_rate_percent).toBe(3);
    expect(dto.financing_tenure_days).toBe(90);
  });

  it("reconstructs progressive facility terms only when the schedule key is absent", () => {
    const dto = buildInvoiceOfferLetterDto(
      {
        offered_amount: 100_000,
        platform_fee_rate_percent: 3,
      },
      {
        facility_fee_rate_percent: 1,
        approved_facility: 200_000,
      }
    );
    expect(dto.fee_schedule_version).toBeUndefined();
    expect(dto.facility_fee_rate_percent).toBe(1);
    expect(dto.facility_fee_cap_amount).toBe(2_000);
  });
});

describe("buildInvoiceOfferLetterTerms", () => {
  it("labels the stored platform fee as Drawdown fee of actual funded amount", () => {
    const terms = buildInvoiceOfferLetterTerms("inv-123", {
      requested_amount: 10_000,
      offered_amount: 8_000,
      offered_ratio_percent: 80,
      offered_profit_rate_percent: 12,
      financing_tenure_days: 90,
      risk_rating: "B",
      platform_fee_rate_percent: 2.5,
      expires_at: "2026-12-31T00:00:00.000Z",
    });
    expect(terms).toContainEqual({
      label: "Risk rating",
      value: "B",
    });
    expect(terms[0]).toEqual({ label: "CashSouk Reference", value: "inv-123" });
    expect(terms).toContainEqual({
      label: "Financing margin",
      value: "80%",
    });
    expect(terms).toContainEqual({
      label: "Indicative profit",
      value: "RM 236.71",
    });
    expect(terms).toContainEqual({
      label: "Indicative amount payable",
      value: "RM 8,236.71",
    });
    expect(terms).toContainEqual({
      label: "Financing tenure",
      value: "90 days from disbursement",
    });
    expect(terms).toContainEqual({
      label: "Drawdown fee",
      value: "2.5% of the actual funded amount. Charged only if funding succeeds.",
    });
    expect(terms.some((term) => term.label.startsWith("Platform fee"))).toBe(false);
  });

  it("defaults drawdown fee display to zero when omitted", () => {
    const terms = buildInvoiceOfferLetterTerms("inv-456", {
      offered_amount: 1,
      offered_ratio_percent: 100,
      offered_profit_rate_percent: 0,
      expires_at: "2026-06-01T00:00:00.000Z",
    });
    expect(terms).toContainEqual({
      label: "Drawdown fee",
      value: "0% of the actual funded amount. Charged only if funding succeeds.",
    });
  });

  it("prints frozen v1 collection RM and named additional lines without progressive facility wording", () => {
    const terms = buildInvoiceOfferLetterTerms("inv-v1", {
      offered_amount: 100_000,
      offered_ratio_percent: 80,
        offered_profit_rate_percent: 12,
        financing_tenure_days: 90,
        platform_fee_rate_percent: 3,
        fee_schedule_version: 1,
      facility_fee_collect_amount: 800,
      additional_fees: [
        { name: "Legal fee", kind: "amount", value: 500 },
        { name: "Arrangement", kind: "percent_of_funded", value: 1 },
      ],
      facility_fee_rate_percent: 1,
      facility_fee_cap_amount: 2_000,
    });
    expect(terms).toContainEqual({
      label: "Facility fee collection",
      value: "RM 800.00 (exact amount on this offer). Charged only if funding succeeds.",
    });
    expect(terms).toContainEqual({
      label: "Legal fee",
      value: "RM 500.00 (fixed). Charged only if funding succeeds.",
    });
    expect(terms).toContainEqual({
      label: "Arrangement",
      value: "1% of the actual funded amount. Charged only if funding succeeds.",
    });
    expect(terms.map((term) => `${term.label} ${term.value}`).join(" ")).not.toMatch(
      /progressively|of each disbursed/i
    );
    expect(terms.some((term) => term.label === "Facility fee cap")).toBe(false);
    expect(terms.some((term) => term.label === "Facility fee rate")).toBe(false);
  });

  it("makes a frozen 0 RM facility collection explicit on v1", () => {
    const terms = buildInvoiceOfferLetterTerms("inv-zero", {
      offered_amount: 50_000,
      platform_fee_rate_percent: 0,
      fee_schedule_version: 1,
      facility_fee_collect_amount: 0,
      additional_fees: [],
    });
    expect(terms).toContainEqual({
      label: "Facility fee collection",
      value: "RM 0.00 (exact amount on this offer). Charged only if funding succeeds.",
    });
  });

  it("keeps progressive facility wording for grandfather invoice offers", () => {
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
    expect(terms).toContainEqual({
      label: "Facility fee collection",
      value:
        "Deducted from issuer disbursement progressively when invoice financing is disbursed, subject to the facility fee cap",
    });
  });
});

describe("generateContractOfferLetterBuffer", () => {
  it("returns one signset per signatory in order", async () => {
    const { signsets } = await generateContractOfferLetterBuffer(
      "contract-1",
      { offered_facility: 100_000, expires_at: "2026-12-31T00:00:00.000Z" },
      [
        { name: "Director One", email: "d1@co.my" },
        { name: "Director Two", email: "d2@co.my" },
      ]
    );

    expect(signsets).toHaveLength(2);
    expect(signsets[0]).toEqual([
      expect.objectContaining({
        fieldtype: "sign",
        pageindex: expect.any(Number),
        top: expect.any(Number),
        left: 140,
        height: 30,
        width: 100,
      }),
    ]);
    expect(signsets[1]).toEqual([
      expect.objectContaining({
        fieldtype: "sign",
        pageindex: expect.any(Number),
        top: expect.any(Number),
      }),
    ]);
    expect(signsets[0][0].top).not.toBe(signsets[1][0].top);
  });
});

describe("generateGuarantorAgreementPlaceholderBuffer", () => {
  it("returns one signset per signatory in order", async () => {
    const { signsets, pdfBuffer } = await generateGuarantorAgreementPlaceholderBuffer([
      { name: "Director One", email: "d1@co.my" },
      { name: "Guarantor One", email: "g1@co.my" },
    ]);

    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(signsets).toHaveLength(2);
    expect(signsets[0]).toEqual([
      expect.objectContaining({
        fieldtype: "sign",
        pageindex: expect.any(Number),
        top: expect.any(Number),
        left: 140,
        height: 30,
        width: 100,
      }),
    ]);
  });
});

describe("invoice utilisation offer letter", () => {
  it("uses utilisation headings when the invoice is on a facility", () => {
    expect(invoiceOfferLetterKindForContract("con-1")).toBe("utilisation");
    expect(invoiceOfferLetterKindForContract(null)).toBe("invoice");
    expect(invoiceOfferLetterPresentation("utilisation")).toMatchObject({
      title: "UTILISATION OFFER — INVOICE FINANCING",
      subtitle: "Utilisation of your existing approved facility against the invoice identified below",
      particularsSection: "Particulars of this utilisation",
      termsSection: UTILISATION_OFFER_TERMS_TITLE,
    });
    expect(invoiceOfferLetterPresentation("utilisation").intro).toMatch(/verification code/i);
    expect(invoiceOfferLetterPresentation("utilisation").intro).not.toMatch(/definitive documentation/i);
    expect(invoiceOfferLetterPresentation("utilisation").includeSignatureBlocks).toBe(false);
    expect(invoiceOfferLetterPresentation("invoice").termsSection).toBe("General");
    expect(invoiceOfferLetterPresentation("invoice").intro).toMatch(/definitive documentation/i);
    expect(invoiceOfferLetterPresentation("invoice").includeSignatureBlocks).toBe(true);
  });

  it("writes the required confirmations and a no-signature close into the utilisation letter", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const source = fs.readFileSync(path.join(__dirname, "offer-letter-pdf.ts"), "utf8");
    expect(source).toContain("UTILISATION_OFFER_CONSENTS");
    expect(source).toContain("UTILISATION_OFFER_CONSENTS_TITLE");
    expect(source).toContain("UTILISATION_FULL_AUTHORISATION_TITLE");
    expect(source).toContain("UTILISATION_OFFER_BINDING_FOOTER");
    expect(source).toContain("drawUtilisationAcceptanceClose");
    expect(source).toContain("if (copy.includeSignatureBlocks)");
  });
});
