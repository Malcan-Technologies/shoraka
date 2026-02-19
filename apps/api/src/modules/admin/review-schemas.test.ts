import {
  reviewSectionRejectSchema,
  reviewSectionRequestAmendmentSchema,
  reviewItemApproveSchema,
  reviewItemRejectSchema,
  reviewItemRequestAmendmentSchema,
} from "./schemas";

describe("Admin Review Schemas", () => {
  describe("reviewSectionRejectSchema", () => {
    it("accepts valid note", () => {
      const result = reviewSectionRejectSchema.safeParse({ note: "Invalid financials" });
      expect(result.success).toBe(true);
    });

    it("rejects empty note", () => {
      const result = reviewSectionRejectSchema.safeParse({ note: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing note", () => {
      const result = reviewSectionRejectSchema.safeParse({});
      expect(result.success).toBe(false);
    });

  });

  describe("reviewSectionRequestAmendmentSchema", () => {
    it("accepts valid note", () => {
      const result = reviewSectionRequestAmendmentSchema.safeParse({
        note: "Please resubmit with updated figures",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty note", () => {
      const result = reviewSectionRequestAmendmentSchema.safeParse({ note: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing note", () => {
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
    it("accepts valid note with itemType and itemId", () => {
      const result = reviewItemRejectSchema.safeParse({
        itemType: "INVOICE",
        itemId: "inv_123",
        note: "Invoice does not match supporting documents",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty note", () => {
      const result = reviewItemRejectSchema.safeParse({
        itemType: "INVOICE",
        itemId: "inv_123",
        note: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing note", () => {
      const result = reviewItemRejectSchema.safeParse({
        itemType: "INVOICE",
        itemId: "inv_123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("reviewItemRequestAmendmentSchema", () => {
    it("accepts valid note with itemType and itemId", () => {
      const result = reviewItemRequestAmendmentSchema.safeParse({
        itemType: "DOCUMENT",
        itemId: "doc:0",
        note: "Please upload a clearer scan",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty note", () => {
      const result = reviewItemRequestAmendmentSchema.safeParse({
        itemType: "DOCUMENT",
        itemId: "doc:0",
        note: "",
      });
      expect(result.success).toBe(false);
    });
  });
});
