import { resolveIssuerProductDisplay, type ProductDisplay } from "./product-display";

describe("resolveIssuerProductDisplay", () => {
  const catalog = new Map<string, ProductDisplay>([
    ["prod_1", { name: "Account Receivable (AR) Financing", imageS3Key: "products/ar.png" }],
  ]);

  it("prefers the catalog name over a missing dashboard name", () => {
    expect(resolveIssuerProductDisplay(catalog, ["prod_1"], [null])).toEqual({
      name: "Account Receivable (AR) Financing",
      imageS3Key: "products/ar.png",
    });
  });

  it("falls back to a stored name when the catalog row is missing", () => {
    expect(resolveIssuerProductDisplay(catalog, ["prod_missing"], ["Invoice financing"])).toEqual({
      name: "Invoice financing",
      imageS3Key: null,
    });
  });

  it("does not surface a raw product id as the label", () => {
    expect(resolveIssuerProductDisplay(catalog, ["prod_missing"], [null])).toEqual({
      name: "",
      imageS3Key: null,
    });
  });
});
