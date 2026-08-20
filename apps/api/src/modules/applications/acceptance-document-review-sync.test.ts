import { hasAnyRejectedAcceptanceDocumentItems } from "./acceptance-document-review-sync";

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
});
