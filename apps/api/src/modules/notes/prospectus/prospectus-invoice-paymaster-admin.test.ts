import {
  buildProspectusInvoicePaymaster,
  toAdminInvoicePaymasterRows,
} from "./prospectus-invoice-paymaster";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-invoice-paymaster.types";

describe("toAdminInvoicePaymasterRows", () => {
  it("maps the same seven investor-visible fields as Preview HTML", () => {
    const section = buildProspectusInvoicePaymaster({
      invoiceSnapshot: { details: { value: 625_000 } },
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymasterSnapshot: {
        name: "Kementerian Kerja Raya (KKR)",
        entity_type: "Federal Government Agency",
      },
      targetAmount: 999_999,
      fundedAmount: 100,
    });

    expect(toAdminInvoicePaymasterRows(section)).toEqual([
      { label: "Invoice Amount", value: "RM 625,000.00" },
      { label: "Invoice Due Date", value: "12 September 2025" },
      { label: "Paymaster", value: "Kementerian Kerja Raya (KKR)" },
      { label: "Nature of Paymaster", value: "Federal Government Agency" },
      { label: "Deed of Assignment (DOA)", value: PROSPECTUS_DATA_NOT_AVAILABLE },
      { label: "Paymaster Rating", value: PROSPECTUS_DATA_NOT_AVAILABLE },
      { label: "Confidence Grading", value: PROSPECTUS_DATA_NOT_AVAILABLE },
    ]);
  });

  it("keeps DNA for unresolved fields and missing snapshots", () => {
    const rows = toAdminInvoicePaymasterRows(
      buildProspectusInvoicePaymaster({
        invoiceSnapshot: {},
        maturityDate: null,
        paymasterSnapshot: {},
      })
    );
    expect(rows.every((r) => r.value === PROSPECTUS_DATA_NOT_AVAILABLE)).toBe(true);
  });
});
