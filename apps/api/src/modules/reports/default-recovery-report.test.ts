jest.mock("../../lib/prisma", () => ({
  prisma: {
    notePositionSnapshot: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { NoteServicingStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { runReport } from "./service";

function snapshot(noteId: string, snapshotDate: string, outstandingTotal: number) {
  return {
    note_id: noteId,
    snapshot_date: new Date(`${snapshotDate}T00:00:00.000Z`),
    servicing_status:
      outstandingTotal === 0 ? NoteServicingStatus.SETTLED : NoteServicingStatus.DEFAULTED,
    outstanding_total: outstandingTotal,
    recovered_principal: outstandingTotal === 0 ? 1000 : 500,
    recovered_profit: 0,
    note: {
      id: noteId,
      note_reference: noteId,
      issuer_snapshot: { companyName: "Acme" },
      default_marked_at: new Date("2025-08-01T00:00:00.000Z"),
      default_reason: "Collections exhausted",
      funded_amount: 1000,
    },
  };
}

describe("default recovery historical report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps a recovered default visible after its settlement-day snapshot", async () => {
    const exact = snapshot("open-default", "2025-09-09", 500);
    const settled = snapshot("settled-default", "2025-09-01", 0);
    (prisma.notePositionSnapshot.findMany as jest.Mock)
      .mockResolvedValueOnce([exact])
      .mockResolvedValueOnce([settled]);
    (prisma.notePositionSnapshot.count as jest.Mock).mockResolvedValue(2);

    const result = await runReport("default_recovery", { asOf: "2025-09-09" });

    expect(result.rows).toEqual([
      expect.objectContaining({ noteId: "settled-default", outstandingTotal: 0 }),
      expect.objectContaining({ noteId: "open-default", outstandingTotal: 500 }),
    ]);
    expect(result.summaries).toEqual([
      expect.objectContaining({ label: "Defaulted notes", count: 2, amount: 500 }),
    ]);
  });

  it("does not fabricate a historical report when the selected date has no daily snapshot", async () => {
    (prisma.notePositionSnapshot.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([snapshot("settled-default", "2025-09-01", 0)]);
    (prisma.notePositionSnapshot.count as jest.Mock).mockResolvedValue(0);

    const result = await runReport("default_recovery", { asOf: "2025-09-09" });

    expect(result.rows).toEqual([]);
    expect(result.emptyReason).toBe("No snapshot for this date");
  });
});
