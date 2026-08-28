import {
  findInvoiceDetailsConfig,
  parsePositiveRmAmount,
  readInvoiceSubLimitPerInvoiceRmFromWorkflow,
} from "./invoice-details-config";

describe("invoice-details-config", () => {
  it("parses a positive RM amount from number or string", () => {
    expect(parsePositiveRmAmount(1000000)).toBe(1000000);
    expect(parsePositiveRmAmount("250000")).toBe(250000);
    expect(parsePositiveRmAmount("0")).toBeNull();
    expect(parsePositiveRmAmount(-1)).toBeNull();
    expect(parsePositiveRmAmount("")).toBeNull();
  });

  it("reads sub_limit_per_invoice_rm from the invoice_details step", () => {
    const workflow = [
      { id: "financing_type", config: {} },
      { id: "invoice_details", config: { sub_limit_per_invoice_rm: 750000 } },
    ];
    expect(findInvoiceDetailsConfig(workflow)?.sub_limit_per_invoice_rm).toBe(750000);
    expect(readInvoiceSubLimitPerInvoiceRmFromWorkflow(workflow)).toBe(750000);
    expect(readInvoiceSubLimitPerInvoiceRmFromWorkflow([])).toBeNull();
  });
});
