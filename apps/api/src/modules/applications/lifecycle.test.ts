import { ApplicationStatus, ContractStatus, InvoiceStatus } from "@cashsouk/types";
import { computeApplicationStatus } from "./lifecycle";

describe("computeApplicationStatus after facility withdraw", () => {
  it("rolls contract-based apps to WITHDRAWN", () => {
    expect(
      computeApplicationStatus(
        { status: ContractStatus.WITHDRAWN },
        [{ status: InvoiceStatus.SUBMITTED }],
        ApplicationStatus.UNDER_REVIEW
      )
    ).toBe(ApplicationStatus.WITHDRAWN);
  });

  it("lets invoice-only apps keep invoice-driven status", () => {
    expect(
      computeApplicationStatus(
        { status: ContractStatus.WITHDRAWN },
        [{ status: InvoiceStatus.APPROVED }, { status: InvoiceStatus.SUBMITTED }],
        ApplicationStatus.INVOICE_PENDING,
        { isInvoiceOnly: true }
      )
    ).toBe(ApplicationStatus.INVOICE_PENDING);
  });
});
