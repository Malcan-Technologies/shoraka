import { calculateCalendarDayCount } from "../calculators";
import {
  buildProspectusDatesPaymaster,
  composeProspectusMaturityDateWithTenure,
  composeProspectusPaymasterDisplay,
  formatProspectusDateUtc,
} from "./prospectus-dates-paymaster";
import { SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT } from "./prospectus-dates-paymaster.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES,
} from "./prospectus-dates-paymaster.types";
import { buildProspectusDatesPaymasterDocument } from "./render-prospectus-dates-paymaster";

describe("prospectus Dates and Paymaster (Page 1 DATA STAGE 2)", () => {
  it("documents canonical sources including closes_at; not funding_closed_at", () => {
    expect(PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES.listingDate.canonicalSource).toBe(
      "note_listings.opens_at"
    );
    expect(PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES.closingDate.canonicalSource).toBe(
      "note_listings.closes_at"
    );
    expect(PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES.closingDate.possibleAlternatives).toContain(
      "funding_closed_at"
    );
    expect(PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES.maturityDate.canonicalSource).toBe(
      "notes.maturity_date"
    );
    expect(PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES.paymasterName.canonicalSource).toBe(
      "notes.paymaster_snapshot.name"
    );
    expect(PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES.paymasterEntityType.canonicalSource).toBe(
      "notes.paymaster_snapshot.entity_type"
    );
  });

  it("formats dates in UTC en-MY long month form", () => {
    expect(formatProspectusDateUtc("2025-05-15T00:00:00.000Z")).toBe("15 May 2025");
    expect(formatProspectusDateUtc("2025-05-30T00:00:00.000Z")).toBe("30 May 2025");
    expect(formatProspectusDateUtc("2025-09-12T00:00:00.000Z")).toBe("12 September 2025");
    expect(formatProspectusDateUtc(null)).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("computes tenure with calculateCalendarDayCount(opens_at, maturity_date) = 120 days", () => {
    const days = calculateCalendarDayCount(
      new Date("2025-05-15T00:00:00.000Z"),
      new Date("2025-09-12T00:00:00.000Z")
    );
    expect(days).toBe(120);

    const built = buildProspectusDatesPaymaster(SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT);
    expect(built.tenure).toBe("120 days");
    expect(built.listingDate).toBe("15 May 2025");
    expect(built.closingDate).toBe("30 May 2025");
    expect(built.maturityDate).toBe("12 September 2025");
    expect(built.paymasterEntityType).toBe("Federal Government Agency");
  });

  it("uses listingClosesAt for Closing Date when available", () => {
    const built = buildProspectusDatesPaymaster({
      ...SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT,
      listingClosesAt: "2025-05-30T00:00:00.000Z",
    });
    expect(built.closingDate).toBe("30 May 2025");
  });

  it("returns Data not available for Closing Date when closes_at is missing", () => {
    const built = buildProspectusDatesPaymaster({
      ...SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT,
      listingClosesAt: null,
    });
    expect(built.closingDate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("does not use funding_closed_at — Closing Date comes only from listingClosesAt", () => {
    const earlyFundingClosedAt = "2025-05-20T12:00:00.000Z";
    const scheduledClosesAt = "2025-05-30T00:00:00.000Z";
    const built = buildProspectusDatesPaymaster({
      ...SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT,
      listingClosesAt: scheduledClosesAt,
    });
    expect(built.closingDate).toBe("30 May 2025");
    expect(built.closingDate).not.toBe(formatProspectusDateUtc(earlyFundingClosedAt));
    expect(Object.keys(SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT)).not.toContain("fundingClosedAt");
  });

  it("keeps listing, closing, and maturity as separate source fields", () => {
    const built = buildProspectusDatesPaymaster(SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT);
    expect(built.listingDate).toBe("15 May 2025");
    expect(built.closingDate).toBe("30 May 2025");
    expect(built.maturityDate).toBe("12 September 2025");
    expect(built.listingDate).not.toBe(built.closingDate);
    expect(built.closingDate).not.toBe(built.maturityDate);
  });

  it("composes maturity with tenure when both available", () => {
    expect(
      composeProspectusMaturityDateWithTenure("12 September 2025", "120 days")
    ).toBe("12 September 2025 (120 days)");
    const built = buildProspectusDatesPaymaster(SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT);
    expect(built.maturityDateWithTenure).toBe("12 September 2025 (120 days)");
  });

  it("composes maturity alone when tenure is missing", () => {
    expect(
      composeProspectusMaturityDateWithTenure("12 September 2025", PROSPECTUS_DATA_NOT_AVAILABLE)
    ).toBe("12 September 2025");
    const built = buildProspectusDatesPaymaster({
      listingOpensAt: null,
      listingClosesAt: "2025-05-30T00:00:00.000Z",
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymasterName: "KKR",
      paymasterEntityType: null,
    });
    expect(built.tenure).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(built.maturityDateWithTenure).toBe("12 September 2025");
    expect(built.maturityDateWithTenure).not.toContain("()");
  });

  it("composes paymaster name with entity type; DNA when name missing", () => {
    expect(
      composeProspectusPaymasterDisplay(
        "Kementerian Kerja Raya (KKR)",
        "Federal Government Agency"
      )
    ).toBe("Kementerian Kerja Raya (KKR) (Federal Government Agency)");
    expect(composeProspectusPaymasterDisplay("KKR", null)).toBe("KKR");
    expect(composeProspectusPaymasterDisplay(null, "Federal Government Agency")).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );

    const built = buildProspectusDatesPaymaster(SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT);
    expect(built.paymasterDisplay).toBe(
      "Kementerian Kerja Raya (KKR) (Federal Government Agency)"
    );

    const missingName = buildProspectusDatesPaymaster({
      ...SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT,
      paymasterName: "   ",
      paymasterEntityType: "Federal Government Agency",
    });
    expect(missingName.paymasterDisplay).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missingName.paymasterName).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("returns Data not available when required dates or paymaster fields are missing", () => {
    const missing = buildProspectusDatesPaymaster({
      listingOpensAt: null,
      listingClosesAt: null,
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymasterName: "   ",
      paymasterEntityType: null,
    });
    expect(missing.listingDate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.closingDate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.tenure).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.paymasterName).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.paymasterEntityType).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("renders Closing Date label immediately after Listing Date", () => {
    expect(PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES.closingDate.label).toBe("Closing Date");
    const html = buildProspectusDatesPaymasterDocument();
    expect(html).toContain("Listing Date: 15 May 2025");
    expect(html).toContain("Closing Date: 30 May 2025");
    expect(html).toContain("Maturity Date: 12 September 2025 (120 days)");
    expect(html).toContain(
      "Paymaster: Kementerian Kerja Raya (KKR) (Federal Government Agency)"
    );
    expect(html).not.toContain("Listing Closing Date");
    expect(html.indexOf("Listing Date:")).toBeLessThan(html.indexOf("Closing Date:"));
    expect(html.indexOf("Closing Date:")).toBeLessThan(html.indexOf("Maturity Date:"));
    expect(html).toContain("Federal Government Agency");
    expect(html).not.toContain("funding_closed_at");
  });
});

