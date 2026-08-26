import { resolveAcceptanceReviewApprovalGate } from "./acceptance-document-review-sync";

describe("acceptance-document-review-sync", () => {
  describe("resolveAcceptanceReviewApprovalGate", () => {
    const docKeys = ["acceptance_documents:0:board_resolution"];
    const partyKeys = [
      "authorized_representatives:issuer",
      "authorized_representatives:guarantor:g_co",
    ];

    it("stays unapproved when docs are approved but people are pending", () => {
      const gate = resolveAcceptanceReviewApprovalGate({
        docKeys,
        partyKeys,
        statusByKey: new Map([
          ["acceptance_documents:0:board_resolution", "APPROVED"],
          ["authorized_representatives:issuer", "APPROVED"],
          ["authorized_representatives:guarantor:g_co", "PENDING"],
        ]),
      });
      expect(gate.allApproved).toBe(false);
      expect(gate.hasAmendment).toBe(false);
    });

    it("flags amendment when a party list is requested to change", () => {
      const gate = resolveAcceptanceReviewApprovalGate({
        docKeys,
        partyKeys,
        statusByKey: new Map([
          ["acceptance_documents:0:board_resolution", "APPROVED"],
          ["authorized_representatives:issuer", "APPROVED"],
          ["authorized_representatives:guarantor:g_co", "AMENDMENT_REQUESTED"],
        ]),
      });
      expect(gate.hasAmendment).toBe(true);
      expect(gate.allApproved).toBe(false);
    });

    it("is fully approved only when docs and people are approved", () => {
      const gate = resolveAcceptanceReviewApprovalGate({
        docKeys,
        partyKeys,
        statusByKey: new Map([
          ["acceptance_documents:0:board_resolution", "APPROVED"],
          ["authorized_representatives:issuer", "APPROVED"],
          ["authorized_representatives:guarantor:g_co", "APPROVED"],
        ]),
      });
      expect(gate.allApproved).toBe(true);
      expect(gate.hasAmendment).toBe(false);
    });
  });
});
