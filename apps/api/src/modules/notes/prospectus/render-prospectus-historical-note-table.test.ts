import { formatProspectusDateUtc } from "./prospectus-dates-paymaster";
import { formatProspectusHistoricalNoteStatus } from "./prospectus-historical-note-status";
import {
  buildProspectusHistoricalNoteTable,
  buildProspectusHistoricalNoteTableFromSnapshot,
} from "./prospectus-historical-note-table";
import {
  SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
  SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS,
  SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
} from "./prospectus-historical-note-table.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_HISTORICAL_NOTE_EMPTY_STATE,
  PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS,
} from "./prospectus-historical-note-table.types";
import { buildProspectusHistoricalNoteTableDocument } from "./render-prospectus-historical-note-table";

describe("prospectus Historical Note Table (Page 1 DATA STAGE 8)", () => {
  it("uses exact Canva headers", () => {
    expect([...PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS]).toEqual([
      "Note ID",
      "Financing Type",
      "Amount (RM)",
      "Tenure",
      "Profit Rate (p.a.)",
      "Status",
      "Repayment Date",
    ]);
  });

  it("filters issuer, excludes current Note, sorts updated_at DESC, and limits to 4", () => {
    const table = buildProspectusHistoricalNoteTable(
      SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS,
      {
        issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
        currentNoteId: SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
      }
    );
    expect(table.rows).toHaveLength(4);
    expect(table.rows.map((r) => r.noteId)).toEqual([
      "NOTE-20250301-BBBB2222",
      "NOTE-20240110-AAAA1111",
      "NOTE-20240201-CCCC3333",
      "NOTE-20231101-DDDD4444",
    ]);
    expect(table.rows.map((r) => r.noteId)).not.toContain("NOTE-20250515-0187ABCD");
    expect(table.rows.map((r) => r.noteId)).not.toContain("NOTE-DRAFT-0001");
    expect(table.rows.map((r) => r.noteId)).not.toContain("NOTE-20230101-EEEE5555");
  });

  it("uses funded_amount, raw NOTE reference, Stage 2 tenure, Stage 4A rate, and confirmed status labels", () => {
    const table = buildProspectusHistoricalNoteTable(
      SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS,
      {
        issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
        currentNoteId: SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
      }
    );
    const repaid = table.rows.find((r) => r.noteId === "NOTE-20240110-AAAA1111");
    expect(repaid?.amountRm).toBe("RM 500,000.00");
    expect(repaid?.tenure).toBe("120 days");
    expect(repaid?.profitRate).toBe("12%");
    expect(repaid?.profitRate).not.toBe("12% p.a.");
    expect(repaid?.status).toBe("Repaid");
    expect(repaid?.repaymentDate).toBe(formatProspectusDateUtc("2025-02-12T00:00:00.000Z"));

    expect(formatProspectusHistoricalNoteStatus("ACTIVE")).toBe("Active");
    expect(formatProspectusHistoricalNoteStatus("REPAID")).toBe("Repaid");
    expect(formatProspectusHistoricalNoteStatus("ARREARS")).toBe("In Arrears");
    expect(formatProspectusHistoricalNoteStatus("DEFAULTED")).toBe("Defaulted");
  });

  it("does not generate Fully Repaid or Settled labels", () => {
    expect(formatProspectusHistoricalNoteStatus("REPAID")).not.toBe("Fully Repaid");
    expect(formatProspectusHistoricalNoteStatus("REPAID")).not.toBe("Settled");
    const html = buildProspectusHistoricalNoteTableDocument();
    expect(html).not.toContain("Fully Repaid");
    expect(html).not.toContain("Settled");
    expect(html).not.toContain("<td>REPAID</td>");
  });

  it("shows exact empty-state wording when no eligible rows", () => {
    const table = buildProspectusHistoricalNoteTable([], {
      issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
      currentNoteId: SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
    });
    expect(table.emptyStateMessage).toBe(PROSPECTUS_HISTORICAL_NOTE_EMPTY_STATE);
    const html = buildProspectusHistoricalNoteTableDocument(table);
    expect(html).toContain("No notes are available yet.");
    expect(html).not.toContain("First issuance");
  });

  it("renders funded snapshot rows and hides audit metadata", () => {
    const table = buildProspectusHistoricalNoteTableFromSnapshot([
      {
        note_id: "n1",
        note_reference: "NOTE-20240110-AAAA1111",
        financing_type: "Accounts Receivable Financing-i",
        funded_amount: "500000",
        listing_opens_at: "2025-05-15T00:00:00.000Z",
        maturity_date: "2025-09-12T00:00:00.000Z",
        profit_rate_percent: "12",
        status: "REPAID",
        repaid_at: "2025-02-12T00:00:00.000Z",
        updated_at: "2025-02-12T00:00:00.000Z",
      },
    ]);
    expect(table.audit.snapshot.isFrozen).toBe(true);
    const html = buildProspectusHistoricalNoteTableDocument(table);
    expect(html).toContain("NOTE-20240110-AAAA1111");
    expect(html).toContain("RM 500,000.00");
    expect(html).toContain("Repaid");
    expect(html).not.toContain("issuerGroupingKey");
    expect(html).not.toContain("snapshotDecision");
    expect(html).not.toContain("Investor Return");
    expect(html).not.toContain("On time");
  });

  it("returns DNA for missing funded amount and repayment date", () => {
    const table = buildProspectusHistoricalNoteTable(
      [
        {
          id: "n1",
          issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
          noteReference: null,
          noteStatus: "ACTIVE",
          productName: null,
          fundedAmount: null,
          profitRatePercent: null,
          listingOpensAt: null,
          maturityDate: null,
          repaidAt: null,
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
      {
        issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
        currentNoteId: "other",
      }
    );
    expect(table.rows[0]?.noteId).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(table.rows[0]?.amountRm).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(table.rows[0]?.repaymentDate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });
});
