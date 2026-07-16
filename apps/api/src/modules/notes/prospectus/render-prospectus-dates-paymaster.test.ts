import { calculateCalendarDayCount } from "../calculators";
import { buildProspectusDatesPaymaster, formatProspectusDateUtc } from "./prospectus-dates-paymaster";
import { SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT } from "./prospectus-dates-paymaster.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES,
} from "./prospectus-dates-paymaster.types";
import { buildProspectusDatesPaymasterDocument } from "./render-prospectus-dates-paymaster";

describe("prospectus Dates and Paymaster (Page 1 DATA STAGE 2)", () => {
  it("documents canonical sources without published_at or name aliases", () => {
    expect(PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES.listingDate.canonicalSource).toBe(
      "note_listings.opens_at"
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
    expect(built.maturityDate).toBe("12 September 2025");
    expect(built.paymasterEntityType).toBe("Federal Government Agency");
  });

  it("returns Data not available when required dates or paymaster fields are missing", () => {
    const missing = buildProspectusDatesPaymaster({
      listingOpensAt: null,
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymasterName: "   ",
      paymasterEntityType: null,
    });
    expect(missing.listingDate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.tenure).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.paymasterName).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.paymasterEntityType).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("renders plain HTML with Stage 2 lines", () => {
    const html = buildProspectusDatesPaymasterDocument();
    expect(html).toContain("Listing date: 15 May 2025");
    expect(html).toContain("Maturity date: 12 September 2025");
    expect(html).toContain("Tenure: 120 days");
    expect(html).toContain("Paymaster name: Kementerian Kerja Raya (KKR)");
    expect(html).toContain("Paymaster entity type: Federal Government Agency");
    expect(html).toContain("note_listings.opens_at");
  });
});
