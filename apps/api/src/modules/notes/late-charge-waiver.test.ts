import { NoteSettlementStatus } from "@prisma/client";
import {
  remainingCapsIgnoringApprovedSettlements,
  preSettlementWaiverVoidWhere,
  settlementIdsToVoidForPreSettlementWaiver,
} from "./late-charge-waiver";

describe("settlementIdsToVoidForPreSettlementWaiver", () => {
  it("voids preview and approved settlements when nothing is posted", () => {
    expect(
      settlementIdsToVoidForPreSettlementWaiver([
        { id: "preview-1", status: NoteSettlementStatus.PREVIEW },
        { id: "approved-1", status: NoteSettlementStatus.APPROVED },
        { id: "void-1", status: NoteSettlementStatus.VOID },
      ])
    ).toEqual(["preview-1", "approved-1"]);
  });

  it("leaves posted settlements untouched", () => {
    expect(
      settlementIdsToVoidForPreSettlementWaiver([
        { id: "posted-1", status: NoteSettlementStatus.POSTED },
        { id: "preview-1", status: NoteSettlementStatus.PREVIEW },
        { id: "approved-1", status: NoteSettlementStatus.APPROVED },
      ])
    ).toEqual([]);
  });
});

describe("preSettlementWaiverVoidWhere", () => {
  it("refuses to void a settlement that was posted while the waiver held the note lock", () => {
    expect(preSettlementWaiverVoidWhere(["approved-1"])).toEqual({
      id: { in: ["approved-1"] },
      status: { in: [NoteSettlementStatus.PREVIEW, NoteSettlementStatus.APPROVED] },
    });
  });
});

describe("remainingCapsIgnoringApprovedSettlements", () => {
  it("adds approved applied amounts back so a waiver can replace a stale split", () => {
    expect(
      remainingCapsIgnoringApprovedSettlements(
        { remainingTawidhAmount: 10, remainingGharamahAmount: 5 },
        [
          {
            status: NoteSettlementStatus.APPROVED,
            tawidhAmount: 20,
            gharamahAmount: 4,
          },
          {
            status: NoteSettlementStatus.PREVIEW,
            tawidhAmount: 99,
            gharamahAmount: 99,
          },
        ]
      )
    ).toEqual({ remainingTawidhAmount: 30, remainingGharamahAmount: 9 });
  });
});
