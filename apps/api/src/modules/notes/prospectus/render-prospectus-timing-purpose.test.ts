import { buildProspectusTenureAndMaturity } from "./prospectus-dates-paymaster";
import { SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT } from "./prospectus-dates-paymaster.sample-data";
import { buildProspectusTimingPurpose } from "./prospectus-timing-purpose";
import { SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT } from "./prospectus-timing-purpose.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES,
} from "./prospectus-timing-purpose.types";
import { buildProspectusTimingPurposeDocument } from "./render-prospectus-timing-purpose";

describe("prospectus Timing and Purpose (Page 1 DATA STAGE 4B)", () => {
  it("documents Stage 2 reuse and live Application purpose path", () => {
    expect(PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES.tenure.canonicalSource).toContain(
      "buildProspectusTenureAndMaturity"
    );
    expect(PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES.purposeOfFinancing.canonicalSource).toBe(
      "applications.business_details.why_raising_funds.financing_for"
    );
    expect(PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES.purposeOfFinancing.availability).toBe(
      "live_application"
    );
  });

  it("reuses the same tenure and maturity values as Stage 2 for the same dates", () => {
    const stage2 = buildProspectusTenureAndMaturity({
      listingOpensAt: SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.listingOpensAt,
      maturityDate: SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.maturityDate,
    });
    const stage4b = buildProspectusTimingPurpose(SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT);

    expect(stage4b.tenure).toBe(stage2.tenure);
    expect(stage4b.maturityDate).toBe(stage2.maturityDate);
    expect(stage4b.tenure).toBe("120 days");
    expect(stage4b.maturityDate).toBe("12 September 2025");
  });

  it("returns Data not available when dates or purpose are missing", () => {
    const missing = buildProspectusTimingPurpose({
      listingOpensAt: null,
      maturityDate: "2025-09-12T00:00:00.000Z",
      purposeOfFinancing: "   ",
    });
    expect(missing.tenure).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.purposeOfFinancing).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("renders plain HTML with Stage 4B lines", () => {
    const html = buildProspectusTimingPurposeDocument();
    expect(html).toContain("Tenure: 120 days");
    expect(html).toContain("Maturity date: 12 September 2025");
    expect(html).toContain("Purpose of financing: Working capital to fulfill a new contract");
    expect(html).toContain("live Application data");
    expect(html).toContain("why_raising_funds.financing_for");
  });
});
