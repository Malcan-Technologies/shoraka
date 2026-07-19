import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildProspectusIssuerTrackRecord } from "./prospectus-issuer-track-record";
import { SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD_INPUT } from "./prospectus-issuer-track-record.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_TRACK_RECORD_AUDIT,
  PROSPECTUS_ISSUER_TRACK_RECORD_CURRENT_NOTE_EXCLUSION_KEY,
  PROSPECTUS_ISSUER_TRACK_RECORD_FIELD_SOURCES,
  PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE,
  PROSPECTUS_ISSUER_TRACK_RECORD_SECTION_HEADING,
} from "./prospectus-issuer-track-record.types";
import { buildProspectusIssuerTrackRecordDocument } from "./render-prospectus-issuer-track-record";

describe("prospectus Issuer Track-Record Summary (Page 1 DATA STAGE 7)", () => {
  it("documents static heading and unresolved Canva metrics", () => {
    expect(PROSPECTUS_ISSUER_TRACK_RECORD_SECTION_HEADING).toBe(
      "ISSUER'S TRACK RECORD ON CASH SOUK"
    );
    expect(PROSPECTUS_ISSUER_TRACK_RECORD_FIELD_SOURCES.totalNotesFunded.availability).toBe(
      "unresolved"
    );
    expect(PROSPECTUS_ISSUER_TRACK_RECORD_FIELD_SOURCES.totalAmountFunded.notes).toMatch(
      /funded_amount/i
    );
  });

  it("keeps all four metrics Data not available even with historical and dashboard sample inputs", () => {
    const data = buildProspectusIssuerTrackRecord(SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD_INPUT);
    expect(data.sectionHeading).toBe(PROSPECTUS_ISSUER_TRACK_RECORD_SECTION_HEADING);
    expect(data.totalNotesFunded).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.totalAmountFunded).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.successfulRepayment).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.onTimePaymentRate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("does not aggregate target_amount or infer 100% from REPAID-only notes", () => {
    const data = buildProspectusIssuerTrackRecord({
      currentNoteId: "note-current",
      issuerOrganizationId: "org-1",
      historicalNotes: [
        { id: "a", status: "REPAID", fundedAmount: 100_000, targetAmount: 999_999 },
        { id: "b", status: "REPAID", fundedAmount: 200_000, targetAmount: 888_888 },
      ],
    });
    expect(data.totalAmountFunded).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.successfulRepayment).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.successfulRepayment).not.toBe("100%");
    expect(data.totalAmountFunded).not.toContain("999");
  });

  it("does not reuse dashboard onTimePercent or count metrics", () => {
    const data = buildProspectusIssuerTrackRecord({
      dashboardOnTimePercent: 100,
      dashboardActiveNotesCount: 8,
      dashboardCompletedNotesCount: 8,
      dashboardPastFinancingAmount: 3_450_000,
    });
    expect(data.onTimePaymentRate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.totalNotesFunded).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.totalAmountFunded).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.onTimePaymentRate.dashboardMetricReused).toBe(false);
    expect(data.audit.totalNotesFunded.dashboardMetricReused).toBe(false);
  });

  it("records issuer grouping, current-Note exclusion, and candidate amount source in audit", () => {
    const data = buildProspectusIssuerTrackRecord(SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD_INPUT);
    expect(data.audit).toEqual(PROSPECTUS_ISSUER_TRACK_RECORD_AUDIT);
    expect(data.audit.issuer.groupingKey).toBe(PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE);
    expect(data.audit.issuer.groupingKey).toBe("notes.issuer_organization_id");
    expect(data.audit.issuer.currentNoteExclusionKey).toBe(
      PROSPECTUS_ISSUER_TRACK_RECORD_CURRENT_NOTE_EXCLUSION_KEY
    );
    expect(data.audit.issuer.currentNoteExclusionKey).toBe("notes.id");
    expect(data.audit.issuer.currentNoteExcluded).toBe("required");
    expect(data.audit.totalAmountFunded.candidateSource).toBe("notes.funded_amount");
    expect(data.audit.snapshot.isFrozen).toBe(false);
    expect(data.audit.snapshot.snapshotDecision).toBe("pending");
  });

  it("does not implement a prospectus status filter or aggregate formula", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-issuer-track-record.ts"),
      "utf8"
    );
    expect(moduleSource).not.toContain("NoteStatus");
    expect(moduleSource).not.toContain("[ACTIVE");
    expect(moduleSource).not.toContain("[FUNDED");
    expect(moduleSource).not.toContain("filter(");
    expect(moduleSource).not.toContain("reduce(");
    expect(moduleSource).not.toContain("onTimePercent");
    expect(moduleSource).not.toContain("pastFinancingAmount");
  });

  it("renders Canva-facing heading and metrics only; hides audit and sample claims", () => {
    const data = buildProspectusIssuerTrackRecord(SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD_INPUT);
    expect(data.sectionHeading).toBe("ISSUER'S TRACK RECORD ON CASH SOUK");

    const html = buildProspectusIssuerTrackRecordDocument(data);
    // Apostrophe is HTML-escaped in the heading element.
    expect(html).toContain("ISSUER&#39;S TRACK RECORD ON CASH SOUK");
    expect(html).toContain("Total Notes Funded: Data not available");
    expect(html).toContain("Total Amount Funded: Data not available");
    expect(html).toContain("Successful Repayment: Data not available");
    expect(html).toContain("On-time Payment Rate: Data not available");
    expect(html).not.toContain("Proven");
    expect(html).not.toContain("Strong repayment");
    expect(html).not.toContain("Excellent");
    expect(html).not.toContain("Successful track record");
    expect(html).not.toContain("Zero defaults");
    expect(html).not.toContain("Consistent performance");
    expect(html).not.toContain("RM 3.45 mil");
    expect(html).not.toContain("Total Notes Funded: 8");
    expect(html).not.toContain("Successful Repayment: 100%");
    expect(html).not.toContain("On-time Payment Rate: 100%");
    expect(html).not.toContain("issuerOrganizationId");
    expect(html).not.toContain("currentNoteId");
    expect(html).not.toContain("groupingKey");
    expect(html).not.toContain("filterDecision");
    expect(html).not.toContain("dashboardWindow");
    expect(html).not.toContain("isFrozen");
    expect(html).not.toContain("snapshotDecision");
    expect(html).not.toContain("approvalRequired");
    expect(html).not.toContain("Previous issued notes");
    expect(html).not.toContain("Active notes");
    expect(html).not.toContain("Default count");
  });
});
