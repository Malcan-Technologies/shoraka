import { isAcceptanceHubReviewItem } from "./is-acceptance-hub-review-item";

describe("isAcceptanceHubReviewItem", () => {
  it("keeps acceptance document and authorised-representative items", () => {
    expect(
      isAcceptanceHubReviewItem({
        item_type: "document",
        item_id: "acceptance_documents:0:board_resolution",
      })
    ).toBe(true);
    expect(
      isAcceptanceHubReviewItem({
        item_type: "authorized_representatives",
        item_id: "authorized_representatives:issuer",
      })
    ).toBe(true);
  });

  it("excludes underwriting invoices and supporting documents", () => {
    expect(
      isAcceptanceHubReviewItem({
        item_type: "invoice",
        item_id: "invoice_details:0:INV-1",
      })
    ).toBe(false);
    expect(
      isAcceptanceHubReviewItem({
        item_type: "document",
        item_id: "supporting_documents:0:bank_statement",
      })
    ).toBe(false);
  });
});
