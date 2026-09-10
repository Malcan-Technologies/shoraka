import { NoteSettlementStatus } from "@prisma/client";
import {
  remainingCapsIgnoringApprovedSettlements,
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
