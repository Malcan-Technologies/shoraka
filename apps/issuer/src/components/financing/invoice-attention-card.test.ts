import type { IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import {
  getInvoiceAttentionAction,
  invoiceAttentionDetail,
  invoiceAttentionMeta,
} from "./invoice-attention-card-model";

function invoice(overrides: Partial<IssuerDashboardInvoice> = {}): IssuerDashboardInvoice {
  return {
    id: "inv_1",
    displayReference: "INV-ARF-1",
    applicationId: "app_1",
    productId: "prod_1",
    productName: "Account Receivable (AR) Financing",
    contractId: null,
    invoiceForModal: {
      status: "OFFER_SENT",
      offer_details: {},
    },
    invoiceStatus: "OFFER_SENT",
    invoiceNumber: "INV-100",
    customerName: "Acme Trading",
    invoiceValue: "10000",
    financingAmount: "8000",
    submissionDate: "2026-08-01",
    note: null,
    actionRequiredApplicationIds: [],
    ...overrides,
  };
}

describe("getInvoiceAttentionAction", () => {
  it("sends offer review to the application offer tab", () => {
    const action = getInvoiceAttentionAction(invoice());
    expect(action.headline).toBe("Review this offer");
    expect(action.href).toBe("/applications/app_1?tab=offer&invoiceId=inv_1");
    expect(action.label).toBe("Review offer");
    expect(action.hint).toBe("You'll review this on your application.");
  });

  it("names requested updates when acceptance changes are requested", () => {
    const action = getInvoiceAttentionAction(
      invoice({
        invoiceForModal: {
          status: "OFFER_SENT",
          offer_details: { offer_acceptance: { status: "CHANGES_REQUESTED" } },
        },
      })
    );
    expect(action.headline).toBe("Update requested changes");
    expect(action.label).toBe("Update requested changes");
    expect(action.buttonVariant).toBe("outline");
  });

  it("sends amendments to the application editor", () => {
    const action = getInvoiceAttentionAction(
      invoice({
        invoiceStatus: "AMENDMENT_REQUESTED",
        invoiceForModal: { status: "AMENDMENT_REQUESTED" },
        actionRequiredApplicationIds: ["app_1"],
      })
    );
    expect(action.headline).toBe("Make the requested changes");
    expect(action.href).toBe("/applications/app_1/edit");
    expect(action.label).toBe("Make amendments");
  });
});

describe("invoice attention copy", () => {
  it("joins reference and invoice number, and names standalone vs facility", () => {
    expect(invoiceAttentionMeta(invoice())).toContain("INV-ARF-1");
    expect(invoiceAttentionDetail(invoice(), 80)).toBe("On its own · 80% financed");
    expect(invoiceAttentionDetail(invoice({ contractId: "con_1" }), null)).toBe("Part of a facility");
  });
});
