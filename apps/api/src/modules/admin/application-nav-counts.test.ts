import { aggregateApplicationNavCounts } from "./application-nav-counts";

const ACTION_REQUIRED = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "RESUBMITTED",
  "CONTRACT_PENDING",
  "CONTRACT_ACCEPTED",
  "INVOICE_ACCEPTED",
  "SIGNING_PENDING",
  "INVOICE_PENDING",
] as const;

describe("aggregateApplicationNavCounts", () => {
  it("maps versioned product ids to the base product and splits action-required", () => {
    const result = aggregateApplicationNavCounts(
      [
        { productId: "v2", productName: "Invoice v2", status: "SUBMITTED", count: 2 },
        { productId: "v2", productName: "Invoice v2", status: "DRAFT", count: 1 },
        { productId: "v1", productName: "Invoice v1", status: "UNDER_REVIEW", count: 3 },
        { productId: "other", productName: "Term", status: "COMPLETED", count: 4 },
      ],
      [
        { id: "v1", base_id: "invoice" },
        { id: "v2", base_id: "invoice" },
        { id: "other", base_id: null },
      ],
      ACTION_REQUIRED
    );

    expect(result).toEqual(
      expect.arrayContaining([
        {
          baseProductId: "invoice",
          financingTypeLabel: "Invoice v2",
          total: 6,
          actionRequired: 5,
        },
        {
          baseProductId: "other",
          financingTypeLabel: "Term",
          total: 4,
          actionRequired: 0,
        },
      ])
    );
  });

  it("falls back to productId when the product row is missing", () => {
    const result = aggregateApplicationNavCounts(
      [{ productId: "orphan", productName: "Legacy", status: "INVOICE_PENDING", count: 1 }],
      [],
      ACTION_REQUIRED
    );
    expect(result).toEqual([
      {
        baseProductId: "orphan",
        financingTypeLabel: "Legacy",
        total: 1,
        actionRequired: 1,
      },
    ]);
  });

  it("ignores rows without a product id", () => {
    const result = aggregateApplicationNavCounts(
      [
        { productId: null, productName: "Unknown", status: "SUBMITTED", count: 9 },
        { productId: "  ", productName: "Blank", status: "SUBMITTED", count: 2 },
      ],
      [],
      ACTION_REQUIRED
    );
    expect(result).toEqual([]);
  });
});
