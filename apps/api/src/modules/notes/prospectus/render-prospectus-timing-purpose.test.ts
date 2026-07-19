import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildProspectusTenureAndMaturity } from "./prospectus-dates-paymaster";
import { SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT } from "./prospectus-dates-paymaster.sample-data";
import { buildProspectusTimingPurpose } from "./prospectus-timing-purpose";
import { SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT } from "./prospectus-timing-purpose.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PURPOSE_AUDIT,
  PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES,
} from "./prospectus-timing-purpose.types";
import { buildProspectusTimingPurposeDocument } from "./render-prospectus-timing-purpose";

describe("prospectus Timing and Purpose (Page 1 DATA STAGE 4B)", () => {
  it("documents Stage 2 reuse and live Application purpose path", () => {
    expect(PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES.tenure.canonicalSource).toContain(
      "buildProspectusTenureAndMaturity"
    );
    expect(PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES.maturityDate.canonicalSource).toContain(
      "notes.maturity_date"
    );
    expect(PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES.purposeOfFinancing.canonicalSource).toBe(
      "applications.business_details.why_raising_funds.financing_for"
    );
    expect(PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES.purposeOfFinancing.canonicalSource).not.toBe(
      "applications.business_details.financing_for"
    );
    expect(PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES.purposeOfFinancing.availability).toBe(
      "live_application"
    );
  });

  it("formats tenure as 120 days via Stage 2 reuse", () => {
    const stage2 = buildProspectusTenureAndMaturity({
      listingOpensAt: SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.listingOpensAt,
      maturityDate: SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.maturityDate,
    });
    const stage4b = buildProspectusTimingPurpose(SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT);

    expect(stage4b.tenure).toBe(stage2.tenure);
    expect(stage4b.tenure).toBe("120 days");
  });

  it("returns Data not available for tenure when opens_at is missing", () => {
    const missing = buildProspectusTimingPurpose({
      listingOpensAt: null,
      maturityDate: "2025-09-12T00:00:00.000Z",
      purposeOfFinancing: "Working capital needs",
    });
    expect(missing.tenure).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("formats maturity date via Stage 2", () => {
    const stage4b = buildProspectusTimingPurpose(SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT);
    const stage2 = buildProspectusTenureAndMaturity({
      listingOpensAt: SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT.listingOpensAt,
      maturityDate: SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT.maturityDate,
    });
    expect(stage4b.maturityDate).toBe(stage2.maturityDate);
    expect(stage4b.maturityDate).toBe("12 September 2025");
  });

  it("returns Data not available for maturity when maturity_date is missing", () => {
    const missing = buildProspectusTimingPurpose({
      listingOpensAt: "2025-05-15T00:00:00.000Z",
      maturityDate: null,
      purposeOfFinancing: "Working capital needs",
    });
    expect(missing.maturityDate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.tenure).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("preserves exact trimmed purpose free text", () => {
    const text =
      "To finance purchase of raw materials and working capital requirements";
    const built = buildProspectusTimingPurpose({
      listingOpensAt: "2025-05-15T00:00:00.000Z",
      maturityDate: "2025-09-12T00:00:00.000Z",
      purposeOfFinancing: text,
    });
    expect(built.purposeOfFinancing).toBe(text);
  });

  it("trims surrounding whitespace on purpose", () => {
    const built = buildProspectusTimingPurpose({
      listingOpensAt: "2025-05-15T00:00:00.000Z",
      maturityDate: "2025-09-12T00:00:00.000Z",
      purposeOfFinancing:
        "  To finance purchase of raw materials and working capital requirements  ",
    });
    expect(built.purposeOfFinancing).toBe(
      "To finance purchase of raw materials and working capital requirements"
    );
  });

  it("returns Data not available when purpose is missing or blank", () => {
    expect(
      buildProspectusTimingPurpose({
        listingOpensAt: "2025-05-15T00:00:00.000Z",
        maturityDate: "2025-09-12T00:00:00.000Z",
        purposeOfFinancing: null,
      }).purposeOfFinancing
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(
      buildProspectusTimingPurpose({
        listingOpensAt: "2025-05-15T00:00:00.000Z",
        maturityDate: "2025-09-12T00:00:00.000Z",
        purposeOfFinancing: "   ",
      }).purposeOfFinancing
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("does not fall back to how_funds_used or business_plan", () => {
    const built = buildProspectusTimingPurpose({
      listingOpensAt: "2025-05-15T00:00:00.000Z",
      maturityDate: "2025-09-12T00:00:00.000Z",
      purposeOfFinancing: null,
    });
    expect(built.purposeOfFinancing).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    const moduleSource = readFileSync(join(__dirname, "prospectus-timing-purpose.ts"), "utf8");
    expect(moduleSource).not.toContain("how_funds_used");
    expect(moduleSource).not.toContain("business_plan");
    expect(moduleSource).not.toContain("what_does_company_do");
  });

  it("keeps purpose audit as live and not frozen; omits audit from Canva HTML", () => {
    const built = buildProspectusTimingPurpose(SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT);
    expect(built.audit.purpose).toEqual(PROSPECTUS_PURPOSE_AUDIT);
    expect(built.audit.purpose.sourceType).toBe("live_application");
    expect(built.audit.purpose.isFrozen).toBe(false);
    expect(built.audit.purpose.snapshotDecision).toBe("pending");

    const html = buildProspectusTimingPurposeDocument(built);
    expect(html).toContain("Tenure: 120 days");
    expect(html).toContain("Maturity Date: 12 September 2025");
    expect(html).toContain(
      "Purpose of Financing: To finance purchase of raw materials and working capital requirements"
    );
    expect(html).not.toContain("live_application");
    expect(html).not.toContain("isFrozen");
    expect(html).not.toContain("snapshotDecision");
    expect(html).not.toContain("source_application_id");
    expect(html).not.toContain("Closing Date");
    expect(html).not.toContain("Listing Closing Date");
    expect(html).not.toContain("Working Capital");
  });

  it("reuses Stage 2 and does not calculate tenure locally or add closing date", () => {
    const moduleSource = readFileSync(join(__dirname, "prospectus-timing-purpose.ts"), "utf8");
    expect(moduleSource).toContain("buildProspectusTenureAndMaturity");
    expect(moduleSource).not.toContain("calculateCalendarDayCount");
    expect(moduleSource).not.toContain("closes_at");
    expect(moduleSource).not.toContain("Closing Date");

    const typesSource = readFileSync(
      join(__dirname, "prospectus-timing-purpose.types.ts"),
      "utf8"
    );
    expect(typesSource).not.toContain("listingClosesAt");
    expect(typesSource).toContain("closes_at belongs in Stage 2");

    const rendered = buildProspectusTimingPurposeDocument();
    expect(rendered).not.toContain("Closing Date");
    expect(rendered).not.toContain("Listing Closing Date");
  });
});
