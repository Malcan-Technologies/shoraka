import {
  hasInvoiceFormRowChanged,
  invoiceRowHasRequiredFields,
  isInvoiceFormRowEmpty,
  isInvoiceFormRowPartial,
  isInvoiceStepContinueReady,
} from "./invoice-form-row";
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

const emptyRow = (): InvoiceFormModel =>
  row({
    isPersisted: false,
    number: "",
    value: "",
    maturity_date: "",
    financing_tenure_days: undefined,
    document: null,
  });

describe("invoice form row change detection", () => {
  it("treats an unpersisted empty row as unchanged", () => {
    expect(hasInvoiceFormRowChanged(emptyRow(), undefined)).toBe(false);
  });

  it("detects a financing tenure amendment against the persisted baseline", () => {
    const baseline = row();
    expect(hasInvoiceFormRowChanged(row(), baseline)).toBe(false);
    expect(hasInvoiceFormRowChanged(row({ financing_tenure_days: 105 }), baseline)).toBe(true);
    expect(isInvoiceFormRowEmpty(emptyRow())).toBe(true);
  });
});

describe("invoice step Continue presence gate", () => {
  it("treats a started row without tenure or document as partial", () => {
    const started = row({
      isPersisted: false,
      financing_tenure_days: undefined,
      document: null,
    });
    expect(isInvoiceFormRowEmpty(started)).toBe(false);
    expect(invoiceRowHasRequiredFields(started)).toBe(false);
    expect(isInvoiceFormRowPartial(started)).toBe(true);
    expect(invoiceRowHasRequiredFields(started, true)).toBe(false);
  });

  it("counts a pending file as the document field", () => {
    const pendingDoc = row({ isPersisted: false, document: null });
    expect(invoiceRowHasRequiredFields(pendingDoc)).toBe(false);
    expect(invoiceRowHasRequiredFields(pendingDoc, true)).toBe(true);
  });

  it("keeps Continue disabled until invoice_only / existing_contract has a complete invoice", () => {
    expect(
      isInvoiceStepContinueReady({
        invoices: [emptyRow()],
        hasPendingFile: () => false,
        requiresInvoice: true,
        requiresFacilityFeePayment: false,
      })
    ).toBe(false);
  });

  it("allows Continue on a new_contract step with no invoice", () => {
    expect(
      isInvoiceStepContinueReady({
        invoices: [],
        hasPendingFile: () => false,
        requiresInvoice: false,
        requiresFacilityFeePayment: false,
      })
    ).toBe(true);
  });

  it("enables Continue from required fields even when tenure would fail due-date coverage on save", () => {
    expect(
      isInvoiceStepContinueReady({
        invoices: [row({ financing_tenure_days: 30, maturity_date: "22/11/2026" })],
        hasPendingFile: () => false,
        requiresInvoice: true,
        requiresFacilityFeePayment: false,
      })
    ).toBe(true);
  });

  it("blocks Continue while a facility fee is outstanding", () => {
    expect(
      isInvoiceStepContinueReady({
        invoices: [row()],
        hasPendingFile: () => false,
        requiresInvoice: true,
        requiresFacilityFeePayment: true,
      })
    ).toBe(false);
  });
});
