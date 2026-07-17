import { buildProspectusHistoricalNoteTable } from "./prospectus-historical-note-table";
import {
  SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
  SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS,
  SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
} from "./prospectus-historical-note-table.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_HISTORICAL_NOTE_TABLE_COLUMN_SOURCES,
} from "./prospectus-historical-note-table.types";
import { buildProspectusHistoricalNoteTableDocument } from "./render-prospectus-historical-note-table";

describe("prospectus Historical Note Table (Page 1 DATA STAGE 8)", () => {
  it("documents Canva Amount as unresolved and repaid_at as actual repayment source", () => {
    expect(PROSPECTUS_HISTORICAL_NOTE_TABLE_COLUMN_SOURCES.canvaAmountRm.availability).toBe(
      "unresolved"
    );
    expect(PROSPECTUS_HISTORICAL_NOTE_TABLE_COLUMN_SOURCES.actualRepaymentDate.canonicalSource).toBe(
      "notes.repaid_at"
    );
    expect(
      PROSPECTUS_HISTORICAL_NOTE_TABLE_COLUMN_SOURCES.repaymentPerformanceLabel.availability
    ).toBe("unresolved");
  });

  it("excludes current Note and other issuers; formats confirmed columns; no on-time label", () => {
    const rows = buildProspectusHistoricalNoteTable(SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS, {
      issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
      currentNoteId: SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.noteReference)).toEqual([
      "NOTE-20240110-AAAA1111",
      "NOTE-20250301-BBBB2222",
    ]);
    expect(rows[0]?.canvaAmountRm).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(rows[0]?.financingTarget).toBe("RM 300,000.00");
    expect(rows[0]?.fundedAmount).toBe("RM 300,000.00");
    expect(rows[0]?.grossProfitRate).toBe("10% p.a.");
    expect(rows[0]?.tenure).toBe("120 days");
    expect(rows[0]?.noteStatus).toBe("REPAID");
    expect(rows[0]?.actualRepaymentDate).toBe("8 May 2024");
    expect(rows[0]?.repaymentPerformanceLabel).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(rows[1]?.actualRepaymentDate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(rows[1]?.fundedAmount).toBe("RM 400,000.00");
    expect(rows[1]?.financingTarget).toBe("RM 450,000.00");
  });

  it("renders plain HTML table without inventing eligibility or investor return", () => {
    const html = buildProspectusHistoricalNoteTableDocument();
    expect(html).toContain("NOTE-20240110-AAAA1111");
    expect(html).toContain("NOTE-20250301-BBBB2222");
    expect(html).not.toContain("NOTE-20250515-0187ABCD");
    expect(html).not.toContain("NOTE-20240201-CCCC3333");
    expect(html).toContain("No NoteStatus eligibility filter");
    expect(html).not.toContain("Paid on time");
    expect(html).not.toContain("realised");
  });
});
