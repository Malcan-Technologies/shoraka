import { findInvoiceDetailsConfig, parsePositiveRmAmount } from "./invoice-details-config";

describe("invoice-details-config", () => {
  it("parses a positive RM amount from number or string", () => {
    expect(parsePositiveRmAmount(1000000)).toBe(1000000);
    expect(parsePositiveRmAmount("250000")).toBe(250000);
    expect(parsePositiveRmAmount("0")).toBeNull();
    expect(parsePositiveRmAmount(-1)).toBeNull();
    expect(parsePositiveRmAmount("")).toBeNull();
  });

  it("finds invoice_details config from the workflow", () => {
    const workflow = [
      { id: "financing_type", config: {} },
      { id: "invoice_details", config: { max_invoice_value: 750000 } },
    ];
    expect(findInvoiceDetailsConfig(workflow)?.max_invoice_value).toBe(750000);
    expect(findInvoiceDetailsConfig([])).toBeNull();
  });
});
