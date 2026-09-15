import { computeInvoiceDetailsSectionStatus } from "../applications/invoice-details-section-status";

describe("computeInvoiceDetailsSectionStatus", () => {
  const twoKeys = ["invoice_details:0:INV1", "invoice_details:1:INV2"] as const;

  it("returns PENDING when there are no invoice keys", () => {
    expect(computeInvoiceDetailsSectionStatus([], [])).toBe("PENDING");
  });

  it("returns PENDING when an invoice has no row (missing key treated as PENDING)", () => {
    expect(
      computeInvoiceDetailsSectionStatus(twoKeys, [{ item_id: "invoice_details:0:INV1", status: "APPROVED" }])
    ).toBe("PENDING");
  });

  it("returns REJECTED only when all items are rejected", () => {
    expect(
      computeInvoiceDetailsSectionStatus(twoKeys, [
        { item_id: "invoice_details:0:INV1", status: "REJECTED" },
        { item_id: "invoice_details:1:INV2", status: "REJECTED" },
      ])
    ).toBe("REJECTED");
  });

  it("does not return REJECTED when only some invoices are rejected", () => {
    expect(
      computeInvoiceDetailsSectionStatus(twoKeys, [
        { item_id: "invoice_details:0:INV1", status: "REJECTED" },
        { item_id: "invoice_details:1:INV2", status: "APPROVED" },
      ])
    ).toBe("PENDING");
  });

  it("returns PENDING if any item is still pending", () => {
    expect(
      computeInvoiceDetailsSectionStatus(twoKeys, [
        { item_id: "invoice_details:0:INV1", status: "APPROVED" },
        { item_id: "invoice_details:1:INV2", status: "PENDING" },
      ])
    ).toBe("PENDING");
  });

  it("returns APPROVED when all items approved", () => {
    expect(
      computeInvoiceDetailsSectionStatus(twoKeys, [
        { item_id: "invoice_details:0:INV1", status: "APPROVED" },
        { item_id: "invoice_details:1:INV2", status: "APPROVED" },
      ])
    ).toBe("APPROVED");
  });

  it("returns AMENDMENT_REQUESTED when not all approved and at least one amendment", () => {
    expect(
      computeInvoiceDetailsSectionStatus(twoKeys, [
        { item_id: "invoice_details:0:INV1", status: "APPROVED" },
        { item_id: "invoice_details:1:INV2", status: "AMENDMENT_REQUESTED" },
      ])
    ).toBe("AMENDMENT_REQUESTED");
  });

  it("returns OFFER_SENT when not all approved and an offer is out", () => {
    expect(
      computeInvoiceDetailsSectionStatus(twoKeys, [
        { item_id: "invoice_details:0:INV1", status: "OFFER_SENT" },
        { item_id: "invoice_details:1:INV2", status: "APPROVED" },
      ])
    ).toBe("OFFER_SENT");
  });

  it("prefers AMENDMENT_REQUESTED over OFFER_SENT when both present", () => {
    expect(
      computeInvoiceDetailsSectionStatus(twoKeys, [
        { item_id: "invoice_details:0:INV1", status: "OFFER_SENT" },
        { item_id: "invoice_details:1:INV2", status: "AMENDMENT_REQUESTED" },
      ])
    ).toBe("AMENDMENT_REQUESTED");
  });
});
