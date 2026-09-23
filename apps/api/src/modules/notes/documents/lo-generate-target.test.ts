import { letterOfOfferGenerateTarget } from "./lo-generate-target";

describe("letterOfOfferGenerateTarget", () => {
  it("uses the invoice offer when the invoice is not linked to a facility", () => {
    expect(
      letterOfOfferGenerateTarget({
        sourceInvoiceId: "inv_1",
        sourceContractId: null,
        invoiceContractId: null,
      })
    ).toEqual({ invoiceId: "inv_1", contractId: null });
  });

  it("uses the facility offer when the invoice is linked to a contract", () => {
    expect(
      letterOfOfferGenerateTarget({
        sourceInvoiceId: "inv_1",
        sourceContractId: "c1",
        invoiceContractId: "c1",
      })
    ).toEqual({ invoiceId: null, contractId: "c1" });
  });

  it("uses the facility offer when the note has a contract and no invoice", () => {
    expect(
      letterOfOfferGenerateTarget({
        sourceInvoiceId: null,
        sourceContractId: "c1",
        invoiceContractId: undefined,
      })
    ).toEqual({ invoiceId: null, contractId: "c1" });
  });

  it("falls back to the invoice contract id when the note has no source_contract_id", () => {
    expect(
      letterOfOfferGenerateTarget({
        sourceInvoiceId: "inv_1",
        sourceContractId: null,
        invoiceContractId: "c1",
      })
    ).toEqual({ invoiceId: null, contractId: "c1" });
  });
});
