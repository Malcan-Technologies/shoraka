import { AppError } from "../../lib/http/error-handler";
import {
  assertAcceptanceDocumentChangeRequestAllowed,
  assertAuthorizedRepresentativeChangeRequestAllowed,
  isAcceptanceDocumentItemId,
  isAcceptanceDocumentsAmendmentQueueScope,
  isAcceptanceHubReviewItem,
  shouldNotifyAcceptanceDocumentChanges,
} from "./acceptance-document-change";

describe("acceptance-document-change helpers", () => {
  describe("isAcceptanceDocumentItemId", () => {
    it("matches acceptance item keys only", () => {
      expect(isAcceptanceDocumentItemId("acceptance_documents:0:letter_of_offer")).toBe(true);
      expect(isAcceptanceDocumentItemId("supporting_documents:kyc:0:nric")).toBe(false);
    });
  });

  describe("isAcceptanceHubReviewItem", () => {
    it("matches acceptance docs and authorised-representative lists", () => {
      expect(isAcceptanceHubReviewItem("document", "acceptance_documents:0:board_resolution")).toBe(
        true
      );
      expect(
        isAcceptanceHubReviewItem(
          "authorized_representatives",
          "authorized_representatives:issuer"
        )
      ).toBe(true);
      expect(isAcceptanceHubReviewItem("document", "supporting_documents:kyc:0:nric")).toBe(false);
      expect(
        isAcceptanceHubReviewItem("document", "authorized_representatives:issuer")
      ).toBe(false);
    });
  });

  describe("isAcceptanceDocumentsAmendmentQueueScope", () => {
    it("blocks acceptance section and item scopes", () => {
      expect(isAcceptanceDocumentsAmendmentQueueScope("section", "acceptance_documents")).toBe(true);
      expect(
        isAcceptanceDocumentsAmendmentQueueScope("item", "acceptance_documents:1:board_resolution")
      ).toBe(true);
      expect(
        isAcceptanceDocumentsAmendmentQueueScope("item", "authorized_representatives:issuer")
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

  describe("assertAuthorizedRepresentativeChangeRequestAllowed", () => {
    const snapshot = {
      submitted_by_user_id: "user_1",
      submitted_at: "2026-08-21T00:00:00.000Z",
      parties: [
        {
          key: "issuer",
          entity_kind: "ISSUER" as const,
          representatives: [
            {
              name: "Ali",
              email: "ali@co.my",
              ic_number: "820508105871",
              capacity: "director" as const,
            },
          ],
        },
        {
          key: "g_ind",
          entity_kind: "INDIVIDUAL_GUARANTOR" as const,
          application_guarantor_id: "g_ind",
          representatives: [
            {
              name: "Ali",
              email: "ali@home.my",
              ic_number: "820508105871",
              capacity: "authorised_signatory" as const,
            },
          ],
        },
      ],
    };

    it("allows issuer lists, blocks individual guarantors, and fails closed when the party is missing", () => {
      expect(() =>
        assertAuthorizedRepresentativeChangeRequestAllowed(
          snapshot,
          "authorized_representatives:issuer"
        )
      ).not.toThrow();
      try {
        assertAuthorizedRepresentativeChangeRequestAllowed(
          snapshot,
          "authorized_representatives:guarantor:g_ind"
        );
        fail("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe("INVALID_ACTION");
      }
      expect(() =>
        assertAuthorizedRepresentativeChangeRequestAllowed(
          snapshot,
          "authorized_representatives:guarantor:missing"
        )
      ).toThrow(AppError);
    });
  });
});
