import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NoteSettlementStatus } from "@prisma/client";
import {
  remainingCapsIgnoringApprovedSettlements,
  preSettlementWaiverVoidWhere,
  settlementIdsToVoidForPreSettlementWaiver,
  waiverLinkedSettlementId,
} from "./late-charge-waiver";

const notesService = readFileSync(join(__dirname, "./service.ts"), "utf8");
const previewIdx = notesService.indexOf("async previewSettlement");
const approveIdx = notesService.indexOf("async approveSettlement");
const postIdx = notesService.indexOf("async postSettlement");
const waiveIdx = notesService.indexOf("async waiveLateCharge");
const noteLockSql = "SELECT id FROM notes WHERE id = ${id} FOR UPDATE";

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

describe("settlement status changes share the note lock", () => {
  it("locks the note before preview, approve, post, and waiver writes", () => {
    expect(notesService.slice(previewIdx, approveIdx)).toContain(noteLockSql);
    expect(notesService.slice(approveIdx, postIdx)).toContain(noteLockSql);
    expect(notesService.slice(postIdx, waiveIdx)).toContain(noteLockSql);
    expect(notesService.slice(waiveIdx, waiveIdx + 1500)).toContain(noteLockSql);
    const nextMethodIdx = notesService.indexOf("\n  async ", waiveIdx + 1);
    expect(notesService.slice(waiveIdx, nextMethodIdx === -1 ? undefined : nextMethodIdx)).toContain(
      "waiverLinkedSettlementId"
    );
  });
});

describe("waiverLinkedSettlementId", () => {
  const noteSettlements = [
    { id: "preview-1", status: NoteSettlementStatus.PREVIEW },
    { id: "void-1", status: NoteSettlementStatus.VOID },
  ];

  it("keeps the posted settlement on this note", () => {
    expect(
      waiverLinkedSettlementId({
        postedSettlementId: "posted-1",
        requestedSettlementId: "foreign-1",
        noteSettlements: [{ id: "posted-1", status: NoteSettlementStatus.POSTED }],
        voidedSettlementIds: [],
      })
    ).toBe("posted-1");
  });

  it("does not attach a foreign or already-void settlement", () => {
    expect(
      waiverLinkedSettlementId({
        postedSettlementId: null,
        requestedSettlementId: "foreign-1",
        noteSettlements,
        voidedSettlementIds: ["preview-1"],
      })
    ).toBeNull();
    expect(
      waiverLinkedSettlementId({
        postedSettlementId: null,
        requestedSettlementId: "void-1",
        noteSettlements,
        voidedSettlementIds: [],
      })
    ).toBeNull();
    expect(
      waiverLinkedSettlementId({
        postedSettlementId: null,
        requestedSettlementId: "preview-1",
        noteSettlements,
        voidedSettlementIds: ["preview-1"],
      })
    ).toBeNull();
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
