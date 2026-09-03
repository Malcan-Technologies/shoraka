import { NoteServicingStatus, NoteStatus } from "@prisma/client";
import {
  hasReadyHibahReceiptV01,
  isNoteFullySettledForHibahReceipt,
  isPostedSettlementStatus,
} from "./eligibility";

describe("settlement hibah receipt eligibility", () => {
  it("requires REPAID and SETTLED together", () => {
    expect(
      isNoteFullySettledForHibahReceipt({
        status: NoteStatus.REPAID,
        servicing_status: NoteServicingStatus.SETTLED,
      })
    ).toBe(true);
    expect(
      isNoteFullySettledForHibahReceipt({
        status: NoteStatus.ACTIVE,
        servicing_status: NoteServicingStatus.SETTLED,
      })
    ).toBe(false);
    expect(
      isNoteFullySettledForHibahReceipt({
        status: NoteStatus.REPAID,
        servicing_status: NoteServicingStatus.CURRENT,
      })
    ).toBe(false);
    expect(
      isNoteFullySettledForHibahReceipt({
        status: "REPAID",
        servicingStatus: "SETTLED",
      })
    ).toBe(true);
  });

  it("treats only POSTED as a posted settlement", () => {
    expect(isPostedSettlementStatus("POSTED")).toBe(true);
    expect(isPostedSettlementStatus("APPROVED")).toBe(false);
    expect(isPostedSettlementStatus("PREVIEW")).toBe(false);
  });

  it("detects an existing READY V01", () => {
    expect(
      hasReadyHibahReceiptV01(
        [
          { version: "V01", status: "FAILED" },
          { version: "V01", status: "READY" },
        ],
        "V01"
      )
    ).toBe(true);
    expect(hasReadyHibahReceiptV01([{ version: "V01", status: "PENDING" }], "V01")).toBe(false);
  });
});
