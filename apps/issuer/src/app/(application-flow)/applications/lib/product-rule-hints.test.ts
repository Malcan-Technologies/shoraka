import type { InvoiceProductRules } from "@cashsouk/types";
import { resolveInvoiceFinancingRatioBounds } from "@cashsouk/types";
import {
  buildFinancingAmountHint,
  buildInvoiceValueHint,
  buildInvoiceValueTooltip,
} from "./product-rule-hints";

jest.mock(
  "@cashsouk/ui",
  () => ({
    formatMoney: (value: number) =>
      value.toLocaleString("en-MY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  }),
  { virtual: true }
);

function rules(overrides: Partial<InvoiceProductRules> = {}): InvoiceProductRules {
  return {
    minInvoiceFaceValue: null,
    maxInvoiceFaceValue: null,
    minFinancingAmount: null,
    maxFinancingAmount: null,
    subLimitPerInvoiceRm: null,
    ratio: resolveInvoiceFinancingRatioBounds(null, null),
    minMonthsApplicationToMaturity: null,
    minMonthsReviewToMaturity: null,
    ...overrides,
  };
}

describe("product-rule-hints", () => {
  it("builds invoice value hints only for configured face limits", () => {
    expect(buildInvoiceValueHint(null)).toBeUndefined();
    expect(buildInvoiceValueHint(rules())).toBeUndefined();
    expect(buildInvoiceValueHint(rules({ minInvoiceFaceValue: 5000 }))).toBe("Min RM 5,000.00");
    expect(buildInvoiceValueHint(rules({ maxInvoiceFaceValue: 500000 }))).toBe(
      "Max RM 500,000.00"
    );
    expect(
      buildInvoiceValueHint(rules({ minInvoiceFaceValue: 5000, maxInvoiceFaceValue: 500000 }))
    ).toBe("Allowed: RM 5,000.00 – RM 500,000.00");
  });

  it("builds financing hints from min, max, and facility sub-limit", () => {
    expect(buildFinancingAmountHint(null, true)).toBeUndefined();
    expect(
      buildFinancingAmountHint(
        rules({ minFinancingAmount: 5000, maxFinancingAmount: 400000 }),
        false
      )
    ).toBe("Min RM 5,000.00 · Max RM 400,000.00");
    expect(
      buildFinancingAmountHint(
        rules({
          minFinancingAmount: 5000,
          maxFinancingAmount: 400000,
          subLimitPerInvoiceRm: 250000,
        }),
        true
      )
    ).toBe("Min RM 5,000.00 · Max RM 400,000.00 · Facility sub-limit RM 250,000.00");
    expect(
      buildFinancingAmountHint(rules({ subLimitPerInvoiceRm: 250000 }), false)
    ).toBeUndefined();
  });

  it("adds allowed invoice value lines to the tooltip when configured", () => {
    expect(buildInvoiceValueTooltip(null)).toBe(
      "Invoice value is the total face value of the invoice."
    );
    expect(
      buildInvoiceValueTooltip(rules({ minInvoiceFaceValue: 5000, maxInvoiceFaceValue: 500000 }))
    ).toBe(
      "Invoice value is the total face value of the invoice.\n\nAllowed invoice value:\nMin RM 5,000.00\nMax RM 500,000.00"
    );
  });
});
