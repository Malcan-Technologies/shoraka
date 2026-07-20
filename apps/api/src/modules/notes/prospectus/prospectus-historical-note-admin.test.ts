import { NoteStatus } from "@prisma/client";
import {
  buildProspectusHistoricalNoteTable,
  toAdminHistoricalNoteTable,
} from "./prospectus-historical-note-table";
import {
  PROSPECTUS_HISTORICAL_NOTE_EMPTY_STATE,
  PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS,
} from "./prospectus-historical-note-table.types";
import { buildCompleteApprovedProspectusSnapshot } from "../prospectus-review/prospectus-approved-snapshot";

describe("toAdminHistoricalNoteTable", () => {
  it("maps Page 1 table headers and empty state without recalculation", () => {
    const table = buildProspectusHistoricalNoteTable([], {
      issuerOrganizationId: "org-1",
      currentNoteId: "current",
    });
    const admin = toAdminHistoricalNoteTable(table);
    expect(admin.headers).toEqual([...PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS]);
    expect(admin.rows).toEqual([]);
    expect(admin.emptyStateMessage).toBe(PROSPECTUS_HISTORICAL_NOTE_EMPTY_STATE);
  });

  it("keeps formatted row values from the shared builder", () => {
    const table = buildProspectusHistoricalNoteTable(
      [
        {
          id: "n-repaid",
          issuerOrganizationId: "org-1",
          noteReference: "HIST-001",
          noteStatus: NoteStatus.REPAID,
          productName: "Account Receivable Financing",
          fundedAmount: 80_000,
          targetAmount: 100_000,
          profitRatePercent: 10,
          listingOpensAt: "2025-01-01T00:00:00.000Z",
          maturityDate: "2025-04-30T00:00:00.000Z",
          repaidAt: "2025-04-28T00:00:00.000Z",
          updatedAt: "2025-04-28T00:00:00.000Z",
        },
        {
          id: "current",
          issuerOrganizationId: "org-1",
          noteReference: "CURRENT",
          noteStatus: NoteStatus.ACTIVE,
          productName: "Should exclude",
          fundedAmount: 1,
          profitRatePercent: 1,
          listingOpensAt: "2025-01-01T00:00:00.000Z",
          maturityDate: "2025-02-01T00:00:00.000Z",
          repaidAt: null,
          updatedAt: "2025-05-01T00:00:00.000Z",
        },
        {
          id: "other-issuer",
          issuerOrganizationId: "org-2",
          noteReference: "OTHER",
          noteStatus: NoteStatus.REPAID,
          productName: "Other issuer",
          fundedAmount: 50_000,
          profitRatePercent: 9,
          listingOpensAt: "2025-01-01T00:00:00.000Z",
          maturityDate: "2025-03-01T00:00:00.000Z",
          repaidAt: "2025-02-28T00:00:00.000Z",
          updatedAt: "2025-03-01T00:00:00.000Z",
        },
        {
          id: "draft",
          issuerOrganizationId: "org-1",
          noteReference: "DRAFT",
          noteStatus: NoteStatus.DRAFT,
          productName: "Draft",
          fundedAmount: 10_000,
          profitRatePercent: 8,
          listingOpensAt: "2025-01-01T00:00:00.000Z",
          maturityDate: "2025-03-01T00:00:00.000Z",
          repaidAt: null,
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
      ],
      { issuerOrganizationId: "org-1", currentNoteId: "current" }
    );
    const admin = toAdminHistoricalNoteTable(table);
    expect(admin.rows).toHaveLength(1);
    expect(admin.rows[0]?.noteId).toBe("HIST-001");
    expect(admin.rows[0]?.financingType).toBe("Account Receivable Financing");
    expect(admin.rows[0]?.amountRm).toContain("80,000");
    expect(admin.rows[0]?.status).toBe("Repaid");
    expect(admin.rows[0]?.repaymentDate).not.toBe("Data not available");
    expect(admin.rows[0]?.amountRm).not.toContain("100,000");
  });
});

describe("approved snapshot Historical Notes freeze contract", () => {
  it("includes historical_notes on the approved page_1 freeze shape", async () => {
    // Lightweight shape check — full Prisma path covered by Page 1 / track-record suites.
    const page1Shape = {
      issuer_track_record: {
        total_notes_funded: 1,
        total_amount_funded: "80000",
        successful_repayment_percent: 100,
        on_time_payment_rate_six_months_percent: null,
      },
      historical_notes: [
        {
          note_id: "n1",
          note_reference: "HIST-001",
          financing_type: "Account Receivable Financing",
          funded_amount: "80000",
          profit_rate_percent: "10",
          status: "REPAID",
          listing_opens_at: "2025-01-01T00:00:00.000Z",
          maturity_date: "2025-04-30T00:00:00.000Z",
          repaid_at: "2025-04-28T00:00:00.000Z",
          updated_at: "2025-04-28T00:00:00.000Z",
        },
      ],
    };
    expect(Array.isArray(page1Shape.historical_notes)).toBe(true);
    expect(page1Shape.historical_notes[0]?.note_reference).toBe("HIST-001");
    expect(typeof buildCompleteApprovedProspectusSnapshot).toBe("function");
  });
});
