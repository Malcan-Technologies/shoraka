import { AppError } from "../../lib/http/error-handler";
import {
  assertAcceptanceDocumentIndexEditableInChangesRequested,
  collectFlaggedAcceptanceDocumentIndices,
  findAcceptanceDocumentIndexForS3Key,
  findChangedAcceptanceDocumentIndices,
} from "./acceptance-document-issuer-lock";

describe("acceptance-document-issuer-lock", () => {
  describe("collectFlaggedAcceptanceDocumentIndices", () => {
    it("returns indices for AMENDMENT_REQUESTED acceptance document items", () => {
      const indices = collectFlaggedAcceptanceDocumentIndices([
        {
          item_type: "document",
          item_id: "acceptance_documents:1:board_resolution",
          status: "AMENDMENT_REQUESTED",
        },
        {
          item_type: "document",
          item_id: "acceptance_documents:0:letter_of_offer",
          status: "APPROVED",
        },
        {
          item_type: "document",
          item_id: "supporting_documents:kyc:0:nric",
          status: "AMENDMENT_REQUESTED",
        },
      ]);
      expect([...indices]).toEqual([1]);
    });
  });

  describe("assertAcceptanceDocumentIndexEditableInChangesRequested", () => {
    it("allows flagged indices", () => {
      expect(() =>
        assertAcceptanceDocumentIndexEditableInChangesRequested(1, new Set([1]))
      ).not.toThrow();
    });

    it("rejects non-flagged indices with 403", () => {
      try {
        assertAcceptanceDocumentIndexEditableInChangesRequested(0, new Set([1]));
        fail("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(403);
        expect((error as AppError).code).toBe("EDIT_NOT_ALLOWED");
      }
    });
  });

  describe("findChangedAcceptanceDocumentIndices", () => {
    const before = {
      documents: [
        {
          workflow_document_index: 0,
          file: { s3_key: "a/old.pdf", file_name: "old.pdf" },
        },
        {
          workflow_document_index: 1,
          file: { s3_key: "b/keep.pdf", file_name: "keep.pdf" },
        },
      ],
    };

    it("detects slot changes by index", () => {
      const after = {
        documents: [
          {
            workflow_document_index: 0,
            file: { s3_key: "a/new.pdf", file_name: "new.pdf" },
          },
          {
            workflow_document_index: 1,
            file: { s3_key: "b/keep.pdf", file_name: "keep.pdf" },
          },
        ],
      };
      expect(findChangedAcceptanceDocumentIndices(before, after)).toEqual([0]);
    });

    it("returns empty when payload unchanged", () => {
      expect(findChangedAcceptanceDocumentIndices(before, before)).toEqual([]);
    });
  });

  describe("findAcceptanceDocumentIndexForS3Key", () => {
    it("maps s3 key back to workflow_document_index", () => {
      const data = {
        documents: [
          { workflow_document_index: 0, file: { s3_key: "a/one.pdf" } },
          { workflow_document_index: 2, file: { s3_key: "a/two.pdf" } },
        ],
      };
      expect(findAcceptanceDocumentIndexForS3Key(data, "a/two.pdf")).toBe(2);
      expect(findAcceptanceDocumentIndexForS3Key(data, "missing.pdf")).toBeNull();
    });
  });
});
