import {
  reviewSectionRejectSchema,
  reviewSectionRequestAmendmentSchema,
  reviewItemApproveSchema,
  reviewItemRejectSchema,
  reviewItemRequestAmendmentSchema,
  addPendingAmendmentSchema,
  updatePendingAmendmentSchema,
} from "./schemas";

describe("Admin Review Schemas", () => {
  describe("reviewSectionRejectSchema", () => {
    it("accepts valid remark", () => {
      const result = reviewSectionRejectSchema.safeParse({ remark: "Invalid financials" });
      expect(result.success).toBe(true);
    });

    it("rejects empty remark", () => {
      const result = reviewSectionRejectSchema.safeParse({ remark: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing remark", () => {
      const result = reviewSectionRejectSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("reviewSectionRequestAmendmentSchema", () => {
    it("accepts valid remark", () => {
      const result = reviewSectionRequestAmendmentSchema.safeParse({
        remark: "Please resubmit with updated figures",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty remark", () => {
      const result = reviewSectionRequestAmendmentSchema.safeParse({ remark: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing remark", () => {
      const result = reviewSectionRequestAmendmentSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("reviewItemApproveSchema", () => {
    it("accepts valid itemType and itemId", () => {
      const result = reviewItemApproveSchema.safeParse({
        itemType: "INVOICE",
        itemId: "inv_123",
      });
      expect(result.success).toBe(true);
    });

    it("accepts DOCUMENT item type", () => {
      const result = reviewItemApproveSchema.safeParse({
        itemType: "DOCUMENT",
        itemId: "doc:financial:0",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty itemId", () => {
      const result = reviewItemApproveSchema.safeParse({
        itemType: "INVOICE",
        itemId: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("reviewItemRejectSchema", () => {
    it("accepts valid remark with itemType and itemId", () => {
      const result = reviewItemRejectSchema.safeParse({
        itemType: "INVOICE",
        itemId: "inv_123",
        remark: "Invoice does not match supporting documents",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty remark", () => {
      const result = reviewItemRejectSchema.safeParse({
        itemType: "INVOICE",
        itemId: "inv_123",
        remark: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing remark", () => {
      const result = reviewItemRejectSchema.safeParse({
        itemType: "INVOICE",
        itemId: "inv_123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("reviewItemRequestAmendmentSchema", () => {
    it("accepts valid remark with itemType and itemId", () => {
      const result = reviewItemRequestAmendmentSchema.safeParse({
        itemType: "DOCUMENT",
        itemId: "doc:0",
        remark: "Please upload a clearer scan",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty remark", () => {
      const result = reviewItemRequestAmendmentSchema.safeParse({
        itemType: "DOCUMENT",
        itemId: "doc:0",
        remark: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("addPendingAmendmentSchema", () => {
    it("accepts section scope with scopeKey and remark", () => {
      const result = addPendingAmendmentSchema.safeParse({
        scope: "section",
        scopeKey: "company_details",
        remark: "Please clarify revenue sources",
      });
      expect(result.success).toBe(true);
    });

    it("accepts item scope with itemType, itemId and remark", () => {
      const result = addPendingAmendmentSchema.safeParse({
        scope: "item",
        remark: "Re-upload with signature",
        itemType: "invoice",
        itemId: "inv_123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects section scope without scopeKey", () => {
      const result = addPendingAmendmentSchema.safeParse({
        scope: "section",
        remark: "Missing scopeKey",
      });
      expect(result.success).toBe(false);
    });

    it("rejects item scope without itemType and itemId", () => {
      const result = addPendingAmendmentSchema.safeParse({
        scope: "item",
        remark: "Missing itemType/itemId",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty remark", () => {
      const result = addPendingAmendmentSchema.safeParse({
        scope: "section",
        scopeKey: "company_details",
        remark: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updatePendingAmendmentSchema", () => {
    it("accepts valid remark", () => {
      const result = updatePendingAmendmentSchema.safeParse({
        remark: "Updated amendment details",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty remark", () => {
      const result = updatePendingAmendmentSchema.safeParse({ remark: "" });
      expect(result.success).toBe(false);
    });
  });
});
