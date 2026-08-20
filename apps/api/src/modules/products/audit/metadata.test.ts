import { parseProductAuditMetadata } from "./metadata";

describe("product audit metadata validation", () => {
  it("accepts PRODUCT_CREATED identity fields", () => {
    const parsed = parseProductAuditMetadata("PRODUCT_CREATED", {
      productName: "ARF",
      baseId: "p1",
      version: 1,
      status: "ACTIVE",
      productCode: "ARF",
    });
    expect(parsed.productName).toBe("ARF");
  });

  it("rejects PRODUCT_UPDATED without changedFields", () => {
    expect(() =>
      parseProductAuditMetadata("PRODUCT_UPDATED", {
        productName: "ARF",
        baseId: "p1",
        version: 2,
        changedFields: [],
        before: {},
        after: {},
      })
    ).toThrow();
  });

  it("rejects arbitrary metadata for PRODUCT_DELETED", () => {
    expect(() =>
      parseProductAuditMetadata("PRODUCT_DELETED", {
        productName: "ARF",
        baseId: "p1",
        version: 1,
        previous_status: "ACTIVE",
        new_status: "DELETED",
      })
    ).toThrow();
  });
});
