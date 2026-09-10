import {
  lateFeeExcessPaymentRow,
  lateFeeSettlementAppliedRow,
  lateFeeWaiverMovementRow,
} from "./late-fees-report";

describe("late fee period rows", () => {
  it("does not copy later waiver or payment aggregates onto the settlement posting", () => {
    expect(
      lateFeeSettlementAppliedRow({
        noteId: "n1",
        noteReference: "NOTE-1",
        settlementReference: "SET-1",
        postedAt: "2026-06-15T02:00:00.000Z",
        tawidhApplied: 10,
        gharamahApplied: 20,
        tawidhInvestor: 8,
        tawidhPlatform: 2,
        excessLateChargeAmount: 50,
      })
    ).toMatchObject({
      tawidhApplied: 10,
      gharamahApplied: 20,
      waivedTotal: 0,
      excessPaid: 0,
      excessOwed: 50,
    });
  });

  it("attributes waivers and excess payments to their own timestamps", () => {
    expect(
      lateFeeWaiverMovementRow({
        noteId: "n1",
        noteReference: "NOTE-1",
        createdAt: "2026-07-02T04:00:00.000Z",
        waivedTotal: 15,
      })
    ).toMatchObject({
      postedAt: "2026-07-02T04:00:00.000Z",
      waivedTotal: 15,
      excessPaid: 0,
    });
    expect(
      lateFeeExcessPaymentRow({
        noteId: "n1",
        noteReference: "NOTE-1",
        completedAt: "2026-07-03T04:00:00.000Z",
        excessPaid: 35,
      })
    ).toMatchObject({
      postedAt: "2026-07-03T04:00:00.000Z",
      excessPaid: 35,
      waivedTotal: 0,
    });
  });
});
