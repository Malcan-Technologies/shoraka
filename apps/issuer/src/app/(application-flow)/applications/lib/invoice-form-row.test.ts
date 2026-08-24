import { hasInvoiceFormRowChanged, isInvoiceFormRowEmpty } from "./invoice-form-row";
import type { InvoiceFormModel } from "@/app/(application-flow)/applications/components/invoice-form-fields";

function row(overrides: Partial<InvoiceFormModel> = {}): InvoiceFormModel {
  return {
    id: "inv-1",
    isPersisted: true,
    number: "INV-1",
    value: "10,000.00",
    maturity_date: "22/11/2026",
    financing_ratio_percent: 70,
    financing_tenure_days: 90,
    document: { s3_key: "s3/a", file_name: "inv.pdf" },
    ...overrides,
  };
}

describe("invoice form row change detection", () => {
  it("treats an unpersisted empty row as unchanged", () => {
    expect(
      hasInvoiceFormRowChanged(
        row({
          isPersisted: false,
          number: "",
          value: "",
          maturity_date: "",
          financing_tenure_days: undefined,
          document: null,
        }),
        undefined
      )
    ).toBe(false);
  });

  it("detects a financing tenure amendment against the persisted baseline", () => {
    const baseline = row();
    expect(hasInvoiceFormRowChanged(row(), baseline)).toBe(false);
    expect(hasInvoiceFormRowChanged(row({ financing_tenure_days: 105 }), baseline)).toBe(true);
    expect(isInvoiceFormRowEmpty(row({ isPersisted: false, number: "", value: "", maturity_date: "", document: null }))).toBe(
      true
    );
  });
});
