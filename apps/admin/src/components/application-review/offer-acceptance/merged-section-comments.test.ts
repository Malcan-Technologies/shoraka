import {
  mergeOfferAcceptanceComments,
  offerAcceptanceCommentSourceLabel,
  resolveOfferAcceptanceCommentSection,
} from "./merge-offer-acceptance-comments";

describe("mergeOfferAcceptanceComments", () => {
  it("tags Facility, Invoice, and Acceptance and keeps every thread newest-first", () => {
    const merged = mergeOfferAcceptanceComments(
      [
        {
          id: "a",
          scope: "comment",
          scope_key: "acceptance_documents:1",
          remark: "Acceptance note",
          created_at: "2026-09-11T12:00:00.000Z",
        },
        {
          id: "f",
          scope: "comment",
          scope_key: "contract_details:1",
          remark: "Facility note",
          created_at: "2026-09-10T12:00:00.000Z",
        },
        {
          id: "i",
          scope: "comment",
          scope_key: "invoice_details:0:INV-1",
          remark: "Invoice note",
          created_at: "2026-09-11T08:00:00.000Z",
        },
        {
          id: "other",
          scope: "comment",
          scope_key: "financial:1",
          remark: "Should drop",
          created_at: "2026-09-11T13:00:00.000Z",
        },
      ],
      "new_contract"
    );
    expect(merged.map((row) => row.id)).toEqual(["a", "i", "f"]);
    expect(merged.map((row) => row.sourceLabel)).toEqual(["Acceptance", "Invoice", "Facility"]);
    expect(merged.find((row) => row.id === "f")?.comment).toBe("Facility note");
  });

  it("labels contract_details as Customer on invoice_only", () => {
    expect(offerAcceptanceCommentSourceLabel("contract_details:x", "invoice_only")).toBe("Customer");
    expect(offerAcceptanceCommentSourceLabel("contract_details:x", "new_contract")).toBe("Facility");
  });

  it("posts to acceptance_documents when that section is merged", () => {
    expect(resolveOfferAcceptanceCommentSection(["contract_details", "acceptance_documents"])).toBe(
      "acceptance_documents"
    );
    expect(resolveOfferAcceptanceCommentSection(["invoice_details"])).toBe("invoice_details");
    expect(resolveOfferAcceptanceCommentSection(["contract_details"])).toBe("contract_details");
  });
});
