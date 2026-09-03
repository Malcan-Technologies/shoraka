import { buildReceiptPdfObjectKey } from "./storage";

describe("settlement hibah receipt storage keys", () => {
  it("uses a deterministic private key per note/settlement/version", () => {
    expect(
      buildReceiptPdfObjectKey({
        noteId: "note-1",
        settlementId: "set-1",
        version: "V01",
      })
    ).toMatch(/settlement-hibah-receipts\/.+\/note-1\/set-1\/V01\.pdf$/);
  });
});
