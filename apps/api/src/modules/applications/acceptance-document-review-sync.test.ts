import {
  resolveAcceptanceReviewApprovalGate,
  resolveOfferAcceptancePhaseTarget,
} from "./acceptance-document-review-sync";

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

  describe("resolveOfferAcceptancePhaseTarget", () => {
    const submitted = { status: "PENDING_ADMIN_REVIEW", submitted_at: "2026-09-01T00:00:00.000Z" };

    it("promotes only the reviewed offer when its own parties are approved", () => {
      expect(
        resolveOfferAcceptancePhaseTarget({
          current: submitted,
          hasAmendment: false,
          allApproved: true,
          requiredKeyCount: 2,
        })
      ).toBe("APPROVED_FOR_SIGNING");
    });

    it("leaves a sibling offer waiting when its own parties are still pending", () => {
      expect(
        resolveOfferAcceptancePhaseTarget({
          current: submitted,
          hasAmendment: false,
          allApproved: false,
          requiredKeyCount: 2,
        })
      ).toBeNull();
    });

    it("does not promote invoice A when only invoice B parties are approved", () => {
      const docKeys = ["acceptance_documents:0:board_resolution"];
      const statusByKey = new Map([
        ["acceptance_documents:0:board_resolution", "APPROVED"],
        ["authorized_representatives:issuer", "APPROVED"],
        ["authorized_representatives:guarantor:b", "APPROVED"],
        ["authorized_representatives:guarantor:a", "PENDING"],
      ]);
      const invoiceA = resolveAcceptanceReviewApprovalGate({
        docKeys,
        partyKeys: ["authorized_representatives:issuer", "authorized_representatives:guarantor:a"],
        statusByKey,
      });
      const invoiceB = resolveAcceptanceReviewApprovalGate({
        docKeys,
        partyKeys: ["authorized_representatives:issuer", "authorized_representatives:guarantor:b"],
        statusByKey,
      });
      expect(invoiceB.allApproved).toBe(true);
      expect(invoiceA.allApproved).toBe(false);
      expect(
        resolveOfferAcceptancePhaseTarget({
          current: submitted,
          hasAmendment: invoiceA.hasAmendment,
          allApproved: invoiceA.allApproved,
          requiredKeyCount: 3,
        })
      ).toBeNull();
      expect(
        resolveOfferAcceptancePhaseTarget({
          current: submitted,
          hasAmendment: invoiceB.hasAmendment,
          allApproved: invoiceB.allApproved,
          requiredKeyCount: 3,
        })
      ).toBe("APPROVED_FOR_SIGNING");
    });

    it("does not touch issuer-pending or declined ceremonies", () => {
      expect(
        resolveOfferAcceptancePhaseTarget({
          current: { status: "PENDING_ISSUER" },
          hasAmendment: false,
          allApproved: true,
          requiredKeyCount: 1,
        })
      ).toBeNull();
      expect(
        resolveOfferAcceptancePhaseTarget({
          current: { status: "DECLINED", submitted_at: submitted.submitted_at },
          hasAmendment: false,
          allApproved: true,
          requiredKeyCount: 1,
        })
      ).toBeNull();
    });
  });
});
