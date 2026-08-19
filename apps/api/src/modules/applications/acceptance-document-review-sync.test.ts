import {
  hasAnyRejectedAcceptanceDocumentItems,
  shouldRestoreWithdrawnOfferForAcceptanceReview,
} from "./acceptance-document-review-sync";

describe("acceptance-document-review-sync", () => {
  describe("hasAnyRejectedAcceptanceDocumentItems", () => {
    it("returns true when any configured key is rejected", () => {
      const statusByKey = new Map([
        ["acceptance_documents:0:letter_of_offer", "APPROVED"],
        ["acceptance_documents:1:board_resolution", "REJECTED"],
      ]);
      expect(
        hasAnyRejectedAcceptanceDocumentItems(
          ["acceptance_documents:0:letter_of_offer", "acceptance_documents:1:board_resolution"],
          statusByKey
        )
      ).toBe(true);
    });

    it("returns false when no keys are rejected", () => {
      const statusByKey = new Map([
        ["acceptance_documents:0:letter_of_offer", "PENDING"],
        ["acceptance_documents:1:board_resolution", "APPROVED"],
      ]);
      expect(
        hasAnyRejectedAcceptanceDocumentItems(
          ["acceptance_documents:0:letter_of_offer", "acceptance_documents:1:board_resolution"],
          statusByKey
        )
      ).toBe(false);
    });
  });

  describe("shouldRestoreWithdrawnOfferForAcceptanceReview", () => {
    it("allows restore when rejection was withdrawn and no items remain rejected", () => {
      expect(
        shouldRestoreWithdrawnOfferForAcceptanceReview({
          entityStatus: "WITHDRAWN",
          withdrawReason: "OFFER_REJECTED",
          offerAcceptanceStatus: "REJECTED",
          hasRejectedItems: false,
        })
      ).toBe(true);
    });

    it("blocks restore while any acceptance item is still rejected", () => {
      expect(
        shouldRestoreWithdrawnOfferForAcceptanceReview({
          entityStatus: "WITHDRAWN",
          withdrawReason: "OFFER_REJECTED",
          offerAcceptanceStatus: "REJECTED",
          hasRejectedItems: true,
        })
      ).toBe(false);
    });

    it("blocks restore for non-acceptance withdrawals", () => {
      expect(
        shouldRestoreWithdrawnOfferForAcceptanceReview({
          entityStatus: "WITHDRAWN",
          withdrawReason: "USER_CANCELLED",
          offerAcceptanceStatus: "REJECTED",
          hasRejectedItems: false,
        })
      ).toBe(false);
    });
  });
});
