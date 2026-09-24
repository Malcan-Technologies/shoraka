import { AppError } from "../../lib/http/error-handler";
import {
  assertSupportingDocumentSlotEditable,
  findChangedSupportingDocumentSlots,
  findSupportingDocumentSlotForS3Key,
  hasSupportingDocumentItemLocks,
  supportingDocumentSlotFingerprints,
} from "./supporting-document-issuer-lock";

const before = {
  categories: [
    {
      name: "Financial Docs",
      documents: [
        {
          title: "Latest Management Account",
          workflow_document_index: 0,
          file: { s3_key: "a/old.pdf", file_name: "old.pdf" },
        },
        {
          title: "Audited Accounts",
          workflow_document_index: 1,
          file: { s3_key: "b/keep.pdf", file_name: "keep.pdf" },
        },
      ],
    },
    {
      name: "Legal Docs",
      documents: [
        {
          title: "Deed of Assignment",
          workflow_document_index: 0,
          files: [{ s3_key: "c/doa.pdf", file_name: "doa.pdf" }],
        },
      ],
    },
  ],
};

describe("supporting-document-issuer-lock", () => {
  describe("hasSupportingDocumentItemLocks", () => {
    it("is true when any item key is a supporting document", () => {
      expect(
        hasSupportingDocumentItemLocks(
          new Set(["supporting_documents:financial_docs:0:Latest_Management_Account"])
        )
      ).toBe(true);
    });

    it("is false for other item keys", () => {
      expect(hasSupportingDocumentItemLocks(new Set(["invoice_details:0:Invoice"]))).toBe(false);
      expect(hasSupportingDocumentItemLocks(new Set())).toBe(false);
    });
  });

  describe("assertSupportingDocumentSlotEditable", () => {
    const flagged = new Set(["supporting_documents:financial_docs:0:Latest_Management_Account"]);

    it("allows flagged slots", () => {
      expect(() => assertSupportingDocumentSlotEditable("financial_docs", 0, flagged)).not.toThrow();
    });

    it("allows the :doc: key form", () => {
      expect(() =>
        assertSupportingDocumentSlotEditable(
          "financial_docs",
          0,
          new Set(["supporting_documents:doc:financial_docs:0:Latest_Management_Account"])
        )
      ).not.toThrow();
    });

    it("rejects non-flagged slots with 403 AMENDMENT_LOCKED", () => {
      try {
        assertSupportingDocumentSlotEditable("financial_docs", 1, flagged);
        fail("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(403);
        expect((error as AppError).code).toBe("AMENDMENT_LOCKED");
      }
    });

    it("is a no-op when there are no supporting-document item locks", () => {
      expect(() =>
        assertSupportingDocumentSlotEditable("financial_docs", 1, new Set())
      ).not.toThrow();
    });
  });

  describe("supportingDocumentSlotFingerprints", () => {
    it("keys slots by category and workflow index", () => {
      const fp = supportingDocumentSlotFingerprints(before);
      expect(fp.get("financial_docs:0")).toBe("a/old.pdf");
      expect(fp.get("financial_docs:1")).toBe("b/keep.pdf");
      expect(fp.get("legal_docs:0")).toBe("c/doa.pdf");
    });

    it("unwraps nested supporting_documents payloads", () => {
      const fp = supportingDocumentSlotFingerprints({ supporting_documents: before });
      expect(fp.get("financial_docs:0")).toBe("a/old.pdf");
    });
  });

  describe("findChangedSupportingDocumentSlots", () => {
    it("detects slot changes by category and index", () => {
      const after = {
        categories: [
          {
            name: "Financial Docs",
            documents: [
              {
                title: "Latest Management Account",
                workflow_document_index: 0,
                file: { s3_key: "a/new.pdf", file_name: "new.pdf" },
              },
              {
                title: "Audited Accounts",
                workflow_document_index: 1,
                file: { s3_key: "b/keep.pdf", file_name: "keep.pdf" },
              },
            ],
          },
          {
            name: "Legal Docs",
            documents: [
              {
                title: "Deed of Assignment",
                workflow_document_index: 0,
                files: [{ s3_key: "c/doa.pdf", file_name: "doa.pdf" }],
              },
            ],
          },
        ],
      };
      expect(findChangedSupportingDocumentSlots(before, after)).toEqual([
        { categoryKey: "financial_docs", documentIndex: 0 },
      ]);
    });

    it("returns empty when payload files are unchanged", () => {
      expect(findChangedSupportingDocumentSlots(before, before)).toEqual([]);
    });
  });

  describe("findSupportingDocumentSlotForS3Key", () => {
    it("maps s3 key back to category and workflow index", () => {
      expect(findSupportingDocumentSlotForS3Key(before, "c/doa.pdf")).toEqual({
        categoryKey: "legal_docs",
        documentIndex: 0,
      });
      expect(findSupportingDocumentSlotForS3Key(before, "missing.pdf")).toBeNull();
    });
  });
});
