import { amendmentRemarksForReviewTab } from "./resubmit-amendment-remarks-for-tab";

const remarks = [
  { scope: "section", scope_key: "contract_details", remark: "Fix facility" },
  { scope: "item", scope_key: "invoice_details:inv-1", remark: "Fix invoice" },
  { scope: "section", scope_key: "financial_statements", remark: "Fix financials" },
  { scope: "item", scope_key: "contract_details:customer", remark: "Fix customer" },
];

describe("amendmentRemarksForReviewTab", () => {
  it("keeps single-section behaviour", () => {
    expect(amendmentRemarksForReviewTab("contract_details", remarks).map((r) => r.remark)).toEqual([
      "Fix facility",
      "Fix customer",
    ]);
    expect(amendmentRemarksForReviewTab("financial", remarks).map((r) => r.remark)).toEqual([
      "Fix financials",
    ]);
  });

  it("unions merged sections in API order without repeats", () => {
    expect(
      amendmentRemarksForReviewTab(
        ["contract_details", "invoice_details", "acceptance_documents", "contract_details"],
        remarks
      ).map((r) => r.remark)
    ).toEqual(["Fix facility", "Fix invoice", "Fix customer"]);
  });

  it("returns nothing for an empty section list", () => {
    expect(amendmentRemarksForReviewTab([], remarks)).toEqual([]);
  });
});
