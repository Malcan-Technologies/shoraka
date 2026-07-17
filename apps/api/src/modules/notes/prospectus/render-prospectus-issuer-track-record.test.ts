import { buildProspectusIssuerTrackRecord } from "./prospectus-issuer-track-record";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_TRACK_RECORD_FIELD_SOURCES,
  PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE,
} from "./prospectus-issuer-track-record.types";
import { buildProspectusIssuerTrackRecordDocument } from "./render-prospectus-issuer-track-record";

describe("prospectus Issuer Track-Record Summary (Page 1 DATA STAGE 7)", () => {
  it("documents issuer_organization_id grouping and unresolved prospectus aggregates", () => {
    expect(PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE).toBe("notes.issuer_organization_id");
    expect(
      PROSPECTUS_ISSUER_TRACK_RECORD_FIELD_SOURCES.totalHistoricalAmountRaised.notes
    ).toMatch(/funded_amount/i);
    expect(PROSPECTUS_ISSUER_TRACK_RECORD_FIELD_SOURCES.onTimeRepaymentRate.notes).toMatch(
      /on-time/i
    );
    expect(
      PROSPECTUS_ISSUER_TRACK_RECORD_FIELD_SOURCES.successfullyFundedNotes.availability
    ).toBe("unresolved");
  });

  it("returns documented identity source; metrics and marketing copy unavailable; not frozen", () => {
    const data = buildProspectusIssuerTrackRecord({});
    expect(data.issuerIdentitySource).toBe(PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE);
    expect(data.previousIssuedNotes).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.successfullyFundedNotes).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.activeNotes).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.fullyRepaidNotes).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.totalHistoricalAmountRaised).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.onTimeRepaymentRate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.defaultCount).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.averageInvestorReturn).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.trackRecordSummaryTitle).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.trackRecordSummaryExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.dataFrozenOnCurrentNote).toBe("No");
    expect(data.trackRecordSummaryTitle).not.toMatch(/proven|excellent|strong/i);
  });

  it("renders plain HTML with Stage 7 lines", () => {
    const html = buildProspectusIssuerTrackRecordDocument();
    expect(html).toContain("Issuer identity source: notes.issuer_organization_id");
    expect(html).toContain("Previous issued notes: Data not available");
    expect(html).toContain("Data frozen on current Note: No");
    expect(html).toContain("Current Note must be excluded");
    expect(html).not.toContain("100% repaid");
  });
});
