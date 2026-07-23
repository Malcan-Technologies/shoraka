import {
  computeProspectusSuccessfulRepaymentPercent,
  countProspectusTotalNotesFunded,
  sumProspectusTotalAmountFunded,
} from "../../issuer-dashboard/track-record-aggregates";
import { NoteStatus } from "@prisma/client";
import {
  buildProspectusIssuerTrackRecordFromMetrics,
  buildProspectusIssuerTrackRecordFromSnapshot,
  toAdminIssuerTrackRecordRows,
} from "./prospectus-issuer-track-record";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_TRACK_RECORD_SECTION_HEADING,
  PROSPECTUS_ON_TIME_PAYMENT_RATE_LABEL,
} from "./prospectus-issuer-track-record.types";
import { buildProspectusIssuerTrackRecordDocument } from "./render-prospectus-issuer-track-record";

describe("prospectus Issuer Track-Record Summary (Page 1 DATA STAGE 7)", () => {
  const notes = [
    { id: "current", status: NoteStatus.PUBLISHED, funded_amount: 500_000 },
    { id: "a", status: NoteStatus.ACTIVE, funded_amount: 100_000 },
    { id: "b", status: NoteStatus.REPAID, funded_amount: 200_000 },
    { id: "c", status: NoteStatus.ARREARS, funded_amount: 50_000 },
    { id: "d", status: NoteStatus.DEFAULTED, funded_amount: 25_000 },
    { id: "draft", status: NoteStatus.DRAFT, funded_amount: 1 },
    { id: "pub", status: NoteStatus.PUBLISHED, funded_amount: 1 },
    { id: "fund", status: NoteStatus.FUNDING, funded_amount: 1 },
    { id: "fail", status: NoteStatus.FAILED_FUNDING, funded_amount: 1 },
    { id: "cancel", status: NoteStatus.CANCELLED, funded_amount: 1 },
  ];

  it("uses static heading and Last 6 Months on-time label", () => {
    const data = buildProspectusIssuerTrackRecordFromMetrics({
      totalNotesFunded: 4,
      totalAmountFunded: 375_000,
      successfulRepaymentPercent: 33,
      onTimePaymentRateSixMonthsPercent: 100,
    });
    expect(data.sectionHeading).toBe(PROSPECTUS_ISSUER_TRACK_RECORD_SECTION_HEADING);
    expect(data.onTimePaymentRateLabel).toBe(PROSPECTUS_ON_TIME_PAYMENT_RATE_LABEL);
  });

  it("applies funded-history eligibility and current Note exclusion", () => {
    expect(countProspectusTotalNotesFunded(notes, "current")).toBe(4);
    expect(sumProspectusTotalAmountFunded(notes, "current")).toBe(375_000);
    expect(computeProspectusSuccessfulRepaymentPercent(notes, "current")).toBe(33);
  });

  it("formats metrics and returns DNA for zero repayment denominator / missing on-time", () => {
    const data = buildProspectusIssuerTrackRecordFromMetrics({
      totalNotesFunded: 1,
      totalAmountFunded: 100_000,
      successfulRepaymentPercent: null,
      onTimePaymentRateSixMonthsPercent: null,
    });
    expect(data.totalNotesFunded).toBe("1");
    expect(data.totalAmountFunded).toBe("RM 100,000.00");
    expect(data.successfulRepayment).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.onTimePaymentRate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("maps Admin rows from the same Stage 7 values including no-history display", () => {
    const noHistory = buildProspectusIssuerTrackRecordFromMetrics({
      totalNotesFunded: 0,
      totalAmountFunded: 0,
      successfulRepaymentPercent: null,
      onTimePaymentRateSixMonthsPercent: null,
    });
    expect(toAdminIssuerTrackRecordRows(noHistory)).toEqual([
      { label: "Total Notes Funded — All Time", value: "0" },
      { label: "Total Amount Funded — All Time", value: "RM 0.00" },
      { label: "Successful Repayment — All Time", value: PROSPECTUS_DATA_NOT_AVAILABLE },
      {
        label: PROSPECTUS_ON_TIME_PAYMENT_RATE_LABEL,
        value: PROSPECTUS_DATA_NOT_AVAILABLE,
      },
    ]);
  });

  it("reads frozen snapshot metrics", () => {
    const data = buildProspectusIssuerTrackRecordFromSnapshot({
      total_notes_funded: 2,
      total_amount_funded: "300000",
      successful_repayment_percent: 100,
      on_time_payment_rate_six_months_percent: 80,
      calculated_at: "2025-07-01T00:00:00.000Z",
    });
    expect(data.totalNotesFunded).toBe("2");
    expect(data.totalAmountFunded).toBe("RM 300,000.00");
    expect(data.successfulRepayment).toBe("100%");
    expect(data.onTimePaymentRate).toBe("80%");
    expect(data.audit.snapshot.isFrozen).toBe(true);
  });

  it("renders Canva-facing fields and hides audit metadata", () => {
    const html = buildProspectusIssuerTrackRecordDocument(
      buildProspectusIssuerTrackRecordFromMetrics({
        totalNotesFunded: 3,
        totalAmountFunded: 1_150_000,
        successfulRepaymentPercent: 50,
        onTimePaymentRateSixMonthsPercent: 100,
      })
    );
    expect(html).toContain("ISSUER&#39;S TRACK RECORD ON CASH SOUK");
    expect(html).toContain("Total Notes Funded — All Time: 3");
    expect(html).toContain("Total Amount Funded — All Time: RM 1,150,000.00");
    expect(html).toContain("Successful Repayment — All Time: 50%");
    expect(html).toContain("On-time Payment Rate — Last 6 Months: 100%");
    expect(html).not.toContain("successRatePercent");
    expect(html).not.toContain("groupingKey");
    expect(html).not.toContain("snapshotDecision");
    expect(html).not.toContain("target_amount");
  });
});
