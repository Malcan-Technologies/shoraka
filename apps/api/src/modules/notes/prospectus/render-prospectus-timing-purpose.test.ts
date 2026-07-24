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
  it("documents Stage 2 reuse and frozen purpose_snapshot path", () => {
    expect(PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES.tenure.canonicalSource).toContain(
      "buildProspectusTenureAndMaturity"
    );
    expect(PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES.purposeOfFinancing.canonicalSource).toBe(
      "notes.purpose_snapshot.financing_for"
    );
    expect(PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES.purposeOfFinancing.availability).toBe("stored");
  });

  it("formats tenure and maturity via Stage 2 reuse", () => {
    const stage2 = buildProspectusTenureAndMaturity({
      listingOpensAt: SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.listingOpensAt,
      maturityDate: SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.maturityDate,
    });
    const stage4b = buildProspectusTimingPurpose(SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT);
    expect(stage4b.tenure).toBe(stage2.tenure);
    expect(stage4b.tenure).toBe("120 days");
    expect(stage4b.maturityDate).toBe(stage2.maturityDate);
  });

  it("reads frozen purpose snapshot and ignores live Application fallback", () => {
    const text =
      "To finance purchase of raw materials and working capital requirements";
    const built = buildProspectusTimingPurpose({
      listingOpensAt: "2025-05-15T00:00:00.000Z",
      maturityDate: "2025-09-12T00:00:00.000Z",
      purposeSnapshotFinancingFor: `  ${text}  `,
      liveApplicationFinancingFor: "LIVE APPLICATION TEXT MUST NOT APPEAR",
    });
    expect(built.purposeOfFinancing).toBe(text);
    expect(built.purposeOfFinancing).not.toContain("LIVE APPLICATION");

    const oldNote = buildProspectusTimingPurpose({
      listingOpensAt: "2025-05-15T00:00:00.000Z",
      maturityDate: "2025-09-12T00:00:00.000Z",
      purposeSnapshotFinancingFor: null,
      liveApplicationFinancingFor: "Should not appear",
    });
    expect(oldNote.purposeOfFinancing).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("keeps purpose audit as frozen at note create; omits audit from Canva HTML", () => {
    const built = buildProspectusTimingPurpose(SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT);
    expect(built.audit.purpose).toEqual(PROSPECTUS_PURPOSE_AUDIT);
    expect(built.audit.purpose.isFrozen).toBe(true);
    expect(built.audit.purpose.snapshotDecision).toBe("frozen_at_note_create");

    const html = buildProspectusTimingPurposeDocument(built);
    expect(html).toContain("Purpose of Financing: To finance purchase of raw materials");
    expect(html).not.toContain("live_application");
    expect(html).not.toContain("isFrozen");
    expect(html).not.toContain("Working Capital");
    expect(html).not.toContain("LIVE APPLICATION");
  });

  it("reuses Stage 2 and does not calculate tenure locally", () => {
    const moduleSource = readFileSync(join(__dirname, "prospectus-timing-purpose.ts"), "utf8");
    expect(moduleSource).toContain("buildProspectusTenureAndMaturity");
    expect(moduleSource).not.toContain("calculateCalendarDayCount");
    expect(moduleSource).toContain("void input.liveApplicationFinancingFor");
  });
});
