import {
  buildInvoiceScopeKey,
  invoiceReviewScopeKey,
  resolveInvoiceReviewItemStatus,
} from "./invoice-review-scope";

describe("invoice review scope keys", () => {
  it("matches InvoiceSection invoice_details:{index}:{number} keys", () => {
    expect(buildInvoiceScopeKey(0, "INV-1")).toBe("invoice_details:0:INV-1");
    expect(buildInvoiceScopeKey(1, "A:B")).toBe("invoice_details:1:A_B");
    expect(invoiceReviewScopeKey({ details: { number: "INV-9" } }, 2)).toBe(
      "invoice_details:2:INV-9"
    );
    expect(invoiceReviewScopeKey({ details: {} }, 0)).toBe("invoice_details:0:1");
  });

  it("resolves the selected invoice review-item status", () => {
    const invoices = [
      { id: "inv-1", details: { number: "INV-1" } },
      { id: "inv-2", details: { number: "INV-2" } },
    ];
    const reviewItems = [
      { item_id: "invoice_details:0:INV-1", status: "APPROVED" },
      { item_id: "invoice_details:1:INV-2", status: "REJECTED" },
    ];
    expect(resolveInvoiceReviewItemStatus(invoices, "inv-1", reviewItems)).toBe("APPROVED");
    expect(resolveInvoiceReviewItemStatus(invoices, "inv-2", reviewItems)).toBe("REJECTED");
    expect(resolveInvoiceReviewItemStatus(invoices, "inv-2", [])).toBe("PENDING");
  });
});
