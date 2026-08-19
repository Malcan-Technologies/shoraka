import { AppError } from "../../lib/http/error-handler";
import {
  assertAcceptanceDocumentChangeRequestAllowed,
  isAcceptanceDocumentItemId,
  isAcceptanceDocumentsAmendmentQueueScope,
  shouldNotifyAcceptanceDocumentChanges,
} from "./acceptance-document-change";

describe("acceptance-document-change helpers", () => {
  describe("isAcceptanceDocumentItemId", () => {
    it("matches acceptance item keys only", () => {
      expect(isAcceptanceDocumentItemId("acceptance_documents:0:letter_of_offer")).toBe(true);
      expect(isAcceptanceDocumentItemId("supporting_documents:kyc:0:nric")).toBe(false);
    });
  });

  describe("isAcceptanceDocumentsAmendmentQueueScope", () => {
    it("blocks acceptance section and item scopes", () => {
      expect(isAcceptanceDocumentsAmendmentQueueScope("section", "acceptance_documents")).toBe(true);
      expect(
        isAcceptanceDocumentsAmendmentQueueScope("item", "acceptance_documents:1:board_resolution")
      ).toBe(true);
      expect(isAcceptanceDocumentsAmendmentQueueScope("section", "supporting_documents")).toBe(false);
      expect(
        isAcceptanceDocumentsAmendmentQueueScope("item", "supporting_documents:kyc:0:nric")
      ).toBe(false);
    });
  });

  describe("assertAcceptanceDocumentChangeRequestAllowed", () => {
    it("allows pending, approved, and missing status", () => {
      expect(() => assertAcceptanceDocumentChangeRequestAllowed(undefined)).not.toThrow();
      expect(() => assertAcceptanceDocumentChangeRequestAllowed("PENDING")).not.toThrow();
      expect(() => assertAcceptanceDocumentChangeRequestAllowed("APPROVED")).not.toThrow();
    });

    it("rejects rejected and amendment-requested statuses", () => {
      expect(() => assertAcceptanceDocumentChangeRequestAllowed("REJECTED")).toThrow(AppError);
      expect(() => assertAcceptanceDocumentChangeRequestAllowed("AMENDMENT_REQUESTED")).toThrow(
        AppError
      );
      try {
        assertAcceptanceDocumentChangeRequestAllowed("REJECTED");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe("INVALID_ACTION");
      }
    });
  });

  describe("shouldNotifyAcceptanceDocumentChanges", () => {
    it("notifies only when entering CHANGES_REQUESTED", () => {
      expect(
        shouldNotifyAcceptanceDocumentChanges("PENDING_ADMIN_REVIEW", "CHANGES_REQUESTED")
      ).toBe(true);
      expect(
        shouldNotifyAcceptanceDocumentChanges("APPROVED_FOR_SIGNING", "CHANGES_REQUESTED")
      ).toBe(true);
      expect(
        shouldNotifyAcceptanceDocumentChanges("CHANGES_REQUESTED", "CHANGES_REQUESTED")
      ).toBe(false);
      expect(
        shouldNotifyAcceptanceDocumentChanges("PENDING_ADMIN_REVIEW", "PENDING_ADMIN_REVIEW")
      ).toBe(false);
    });
  });
});
