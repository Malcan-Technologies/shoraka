import { NotePaymentStatus, NoteServicingStatus, NoteStatus } from "@prisma/client";
import { buildProspectusPage1TrackRecordSnapshot } from "./prospectus-track-record-query";

const now = new Date("2025-07-01T00:00:00.000Z");

jest.mock("../../../lib/prisma", () => {
  return {
    prisma: {
      note: {
        findMany: jest.fn(),
      },
      notePaymentSchedule: {
        findMany: jest.fn(),
      },
      notePayment: {
        findMany: jest.fn(),
      },
    },
  };
});

describe("prospectus track-record query (Stage 7/8)", () => {
  const prisma = require("../../../lib/prisma").prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.note.findMany.mockResolvedValue([
      {
        id: "note-current",
        status: NoteStatus.ACTIVE,
        servicing_status: NoteServicingStatus.CURRENT,
        funded_amount: 500_000,
        note_reference: "CUR-001",
        product_snapshot: { product_name: "Accounts Receivable Financing" },
        profit_rate_percent: 10,
        maturity_date: new Date("2025-10-01T00:00:00.000Z"),
        repaid_at: null,
        updated_at: new Date("2025-06-20T00:00:00.000Z"),
        listing: { opens_at: new Date("2025-01-01T00:00:00.000Z") },
      },
      {
        id: "note-late-1",
        status: NoteStatus.PUBLISHED, // intentionally not in funded-history by note.status
        servicing_status: NoteServicingStatus.LATE,
        funded_amount: 150_000,
        note_reference: "LATE-001",
        product_snapshot: { product_name: "Accounts Receivable Financing" },
        profit_rate_percent: 9,
        maturity_date: new Date("2025-08-01T00:00:00.000Z"),
        repaid_at: null,
        updated_at: new Date("2025-06-30T00:00:00.000Z"),
        listing: { opens_at: new Date("2025-02-01T00:00:00.000Z") },
      },
      {
        id: "note-draft",
        status: NoteStatus.DRAFT,
        servicing_status: NoteServicingStatus.CURRENT,
        funded_amount: 10_000,
        note_reference: "DRAFT-001",
        product_snapshot: { product_name: "Accounts Receivable Financing" },
        profit_rate_percent: 8,
        maturity_date: new Date("2025-09-01T00:00:00.000Z"),
        repaid_at: null,
        updated_at: new Date("2025-06-10T00:00:00.000Z"),
        listing: { opens_at: new Date("2025-03-01T00:00:00.000Z") },
      },
    ]);

    // Schedules query should include funded-history note population:
    // note.status in ACTIVE/REPAID/ARREARS/DEFAULTED OR note.servicing_status=LATE.
    prisma.notePaymentSchedule.findMany.mockResolvedValue([
      {
        id: "sched-1",
        note_id: "note-late-1",
        due_date: new Date("2025-06-15T00:00:00.000Z"),
        expected_total: 100,
      },
    ]);

    prisma.notePayment.findMany.mockResolvedValue([
      {
        schedule_id: "sched-1",
        receipt_date: new Date("2025-06-10T00:00:00.000Z"), // on/before due_date => on-time
        receipt_amount: 100,
      },
    ]);
  });

  it("includes LATE notes in historical table + uses LATE schedules for on-time rate population", async () => {
    const snapshot = await buildProspectusPage1TrackRecordSnapshot({
      issuerOrganizationId: "org-1",
      currentNoteId: "note-current",
      now,
    });

    // Historical eligibility: LATE must appear and be labeled as LATE.
    const lateRow = snapshot.historical_notes.find((r) => r.note_id === "note-late-1");
    expect(lateRow).toBeDefined();
    expect(lateRow?.status).toBe("LATE");
    expect(lateRow?.repaid_at).toBeNull();

    // On-time calculation should have eligible schedules (from LATE note) in the 6-month window.
    expect(snapshot.issuer_track_record.on_time_payment_rate_six_months_percent).toBe(100);

    // Verify schedules query includes funded-history population filters.
    const call = prisma.notePaymentSchedule.findMany.mock.calls[0][0];
    expect(call.where.note.issuer_organization_id).toBe("org-1");
    expect(call.where.note.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: {
            in: expect.arrayContaining([
              NoteStatus.ACTIVE,
              NoteStatus.REPAID,
              NoteStatus.ARREARS,
              NoteStatus.DEFAULTED,
            ]),
          },
        }),
        expect.objectContaining({ servicing_status: NoteServicingStatus.LATE }),
      ])
    );
  });
});

