import { buildConfirmationPdfObjectKey } from "./storage";

describe("investment settlement confirmation storage keys", () => {
  it("uses a deterministic private key per note/settlement/investor/version", () => {
    expect(
      buildConfirmationPdfObjectKey({
        noteId: "note-1",
        settlementId: "set-1",
        investorOrganizationId: "org-a",
        version: "V01",
      })
    ).toMatch(/investment-settlement-confirmations\/.+\/note-1\/set-1\/org-a\/V01\.pdf$/);
  });
});
