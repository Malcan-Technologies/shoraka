import { formatProspectusDateUtc } from "./prospectus-dates-paymaster";
import { formatProspectusProfitRatePercent } from "./prospectus-main-financial-terms";
import {
  buildProspectusHistoricalNoteTable,
  buildProspectusHistoricalNoteTableRow,
} from "./prospectus-historical-note-table";
import {
  SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
  SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS,
  SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
} from "./prospectus-historical-note-table.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_HISTORICAL_NOTE_CURRENT_NOTE_EXCLUSION_KEY,
  PROSPECTUS_HISTORICAL_NOTE_ISSUER_GROUPING_KEY,
  PROSPECTUS_HISTORICAL_NOTE_TABLE_AUDIT,
  PROSPECTUS_HISTORICAL_NOTE_TABLE_COLUMN_SOURCES,
  PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS,
  type ProspectusHistoricalNoteRowInput,
} from "./prospectus-historical-note-table.types";
import { buildProspectusHistoricalNoteTableDocument } from "./render-prospectus-historical-note-table";

function baseRow(
  overrides: Partial<ProspectusHistoricalNoteRowInput> & { id: string }
): ProspectusHistoricalNoteRowInput {
  return {
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-TEST-0001",
    noteStatus: "REPAID",
    productName: "Accounts Receivable Financing-i",
    targetAmount: 500_000,
    fundedAmount: 500_000,
    profitRatePercent: 12,
    listingOpensAt: "2025-05-15T00:00:00.000Z",
    maturityDate: "2025-09-12T00:00:00.000Z",
    repaidAt: "2025-02-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("prospectus Historical Note Table (Page 1 DATA STAGE 8)", () => {
  it("documents exact Canva headers and unresolved Amount", () => {
    expect([...PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS]).toEqual([
      "Note ID",
      "Financing Type",
      "Amount (RM)",
      "Tenure",
      "Profit Rate (p.a.)",
      "Status",
      "Repayment Date",
    ]);
    expect(PROSPECTUS_HISTORICAL_NOTE_TABLE_COLUMN_SOURCES.amountRm.availability).toBe(
      "unresolved"
    );
    expect(PROSPECTUS_HISTORICAL_NOTE_TABLE_COLUMN_SOURCES.repaymentDate.canonicalSource).toBe(
      "notes.repaid_at"
    );
  });

  it("formats Note ID, financing type, tenure, profit rate, raw status, and repayment date", () => {
    const row = buildProspectusHistoricalNoteTableRow(baseRow({ id: "n1" }));
    expect(row.noteId).toBe("NOTE-TEST-0001");
    expect(row.financingType).toBe("Accounts Receivable Financing-i");
    expect(row.amountRm).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row.tenure).toBe("120 days");
    expect(row.profitRate).toBe("12%");
    expect(row.profitRate).toBe(formatProspectusProfitRatePercent(12));
    expect(row.profitRate).not.toBe("12% p.a.");
    expect(row.status).toBe("REPAID");
    expect(row.repaymentDate).toBe(formatProspectusDateUtc("2025-02-12T00:00:00.000Z"));
    expect(row.audit.amount.financingTarget).toBe("RM 500,000.00");
    expect(row.audit.amount.fundedAmount).toBe("RM 500,000.00");
  });

  it("returns Data not available for missing reference, product, tenure, status, and repayment", () => {
    const row = buildProspectusHistoricalNoteTableRow(
      baseRow({
        id: "n2",
        noteReference: null,
        productName: null,
        productSnapshotName: "Legacy Name",
        liveProductName: "Live Product",
        listingOpensAt: null,
        maturityDate: null,
        noteStatus: "NOT_A_STATUS",
        repaidAt: null,
      })
    );
    expect(row.noteId).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row.financingType).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row.tenure).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row.status).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row.repaymentDate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("keeps Canva Amount unresolved even when target and funded amounts exist", () => {
    const row = buildProspectusHistoricalNoteTableRow(
      baseRow({ id: "n3", targetAmount: 500_000, fundedAmount: 400_000 })
    );
    expect(row.amountRm).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row.audit.amount.canvaAmountSource).toBe("unresolved");
    expect(row.audit.amount.decision).toBe("pending");
  });

  it("preserves caller order, all statuses, and does not filter current Note or truncate", () => {
    const inputs: ProspectusHistoricalNoteRowInput[] = [
      baseRow({ id: "a", noteReference: "NOTE-A", noteStatus: "DEFAULTED" }),
      baseRow({ id: SAMPLE_PROSPECTUS_CURRENT_NOTE_ID, noteReference: "NOTE-CURRENT", noteStatus: "PUBLISHED" }),
      baseRow({ id: "b", noteReference: "NOTE-B", noteStatus: "ACTIVE", repaidAt: null }),
      baseRow({ id: "c", noteReference: "NOTE-C", noteStatus: "REPAID" }),
      baseRow({ id: "d", noteReference: "NOTE-D", noteStatus: "ARREARS", repaidAt: null }),
      baseRow({
        id: "other",
        issuerOrganizationId: "org-other",
        noteReference: "NOTE-OTHER",
        noteStatus: "FAILED_FUNDING",
        repaidAt: null,
      }),
    ];

    const table = buildProspectusHistoricalNoteTable(inputs, {
      issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
      currentNoteId: SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
    });

    expect(table.rows).toHaveLength(6);
    expect(table.rows.map((r) => r.noteId)).toEqual([
      "NOTE-A",
      "NOTE-CURRENT",
      "NOTE-B",
      "NOTE-C",
      "NOTE-D",
      "NOTE-OTHER",
    ]);
    expect(table.rows.map((r) => r.status)).toEqual([
      "DEFAULTED",
      "PUBLISHED",
      "ACTIVE",
      "REPAID",
      "ARREARS",
      "FAILED_FUNDING",
    ]);
    expect(table.audit).toEqual(PROSPECTUS_HISTORICAL_NOTE_TABLE_AUDIT);
    expect(table.audit.identity.issuerGroupingKey).toBe(
      PROSPECTUS_HISTORICAL_NOTE_ISSUER_GROUPING_KEY
    );
    expect(table.audit.identity.currentNoteExclusionKey).toBe(
      PROSPECTUS_HISTORICAL_NOTE_CURRENT_NOTE_EXCLUSION_KEY
    );
    expect(table.audit.identity.currentNoteExclusionRequired).toBe(true);
    expect(table.audit.table.sortDecision).toBe("pending");
    expect(table.audit.table.rowLimitDecision).toBe("pending");
    expect(table.audit.table.isFrozen).toBe(false);
    expect(table.audit.table.snapshotDecision).toBe("pending");
  });

  it("renders exact Canva headers and cells; hides audit and invented claims", () => {
    const html = buildProspectusHistoricalNoteTableDocument();
    for (const header of PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS) {
      expect(html).toContain(`<th>${header}</th>`);
    }
    expect(html).toContain("NOTE-20240110-AAAA1111");
    expect(html).toContain("Accounts Receivable Financing-i");
    expect(html).toContain("<td>Data not available</td>");
    expect(html).toContain("<td>120 days</td>");
    expect(html).toContain("<td>12%</td>");
    expect(html).toContain("<td>REPAID</td>");
    expect(html).toContain("<td>ACTIVE</td>");
    expect(html).toContain("<td>12 February 2025</td>");
    expect(html).not.toContain("Financing Target");
    expect(html).not.toContain("Funded Amount");
    expect(html).not.toContain("Listing Date");
    expect(html).not.toContain("Activation Date");
    expect(html).not.toContain("Maturity Date");
    expect(html).not.toContain("Repayment Performance");
    expect(html).not.toContain("Investor Return");
    expect(html).not.toContain("Fully Repaid");
    expect(html).not.toContain("12% p.a.");
    expect(html).not.toContain("On time");
    expect(html).not.toContain("Paid on time");
    expect(html).not.toContain("Late repayment");
    expect(html).not.toContain("ARF-");
    expect(html).not.toContain("issuerGroupingKey");
    expect(html).not.toContain("currentNoteExclusionKey");
    expect(html).not.toContain("canvaAmountSource");
    expect(html).not.toContain("statusFilterDecision");
    expect(html).not.toContain("displayMappingDecision");
    expect(html).not.toContain("sortDecision");
    expect(html).not.toContain("rowLimitDecision");
    expect(html).not.toContain("snapshotDecision");
    expect(html).not.toContain("No prior notes");
    expect(html).not.toContain("No historical rows");
  });

  it("uses a plain empty table body when there are no rows", () => {
    const html = buildProspectusHistoricalNoteTableDocument(
      buildProspectusHistoricalNoteTable([])
    );
    expect(html).toContain("<tbody>\n\n    </tbody>");
    expect(html).not.toContain("No prior notes");
    expect(html).not.toContain("First issuance");
  });

  it("keeps sample preview rows without inventing eligibility filtering", () => {
    const table = buildProspectusHistoricalNoteTable(
      SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS,
      {
        issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
        currentNoteId: SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
      }
    );
    expect(table.rows).toHaveLength(SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS.length);
    expect(table.rows[0]?.amountRm).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(table.rows[1]?.repaymentDate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(table.rows[0]?.status).toBe("REPAID");
    expect(table.rows[0]?.status).not.toBe("Fully Repaid");
  });
});
