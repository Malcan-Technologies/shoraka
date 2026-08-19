import type { NoteListItem } from "@cashsouk/types";
import type { IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import { buildFinancingInvoiceRows } from "./financing-invoice-rows";

function invoice(overrides: Partial<IssuerDashboardInvoice> = {}): IssuerDashboardInvoice {
  return {
    id: "inv_1",
    displayReference: "INV-1",
    applicationId: "app_1",
    productId: "prod_1",
    contractId: null,
    invoiceForModal: {},
    invoiceStatus: "APPROVED",
    invoiceNumber: "INV-100",
    customerName: "Acme",
    invoiceValue: "10000",
    financingAmount: "8000",
    submissionDate: "2026-08-01",
    note: null,
    actionRequiredApplicationIds: [],
    ...overrides,
  };
}

function note(overrides: Partial<NoteListItem> = {}): NoteListItem {
  return {
    id: "note_1",
    noteReference: "NOTE-1",
    title: "Acme invoice note",
    productCategory: null,
    productName: "Invoice financing",
    issuerIndustry: null,
    sourceApplicationId: "app_1",
    sourceContractId: null,
    sourceContractDisplayReference: null,
    sourceInvoiceId: "inv_1",
    issuerOrganizationId: "org_1",
    issuerName: null,
    paymasterName: "Acme",
    riskRating: null,
    status: "ACTIVE" as NoteListItem["status"],
    listingStatus: "PUBLISHED" as NoteListItem["listingStatus"],
    fundingStatus: "FUNDED" as NoteListItem["fundingStatus"],
    servicingStatus: "CURRENT" as NoteListItem["servicingStatus"],
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    investorCount: 0,
    maturityDate: null,
    listingClosesAt: null,
    activatedAt: null,
    publishedAt: null,
    fundingClosedAt: null,
    repaidAt: null,
    settlementSummary: null,
    createdAt: "2026-08-01",
    updatedAt: "2026-08-01",
    requestedAmount: 8000,
    invoiceAmount: 10000,
    settlementAmount: 8000,
    targetAmount: 8000,
    fundedAmount: 8000,
    fundingPercent: 100,
    minimumFundingPercent: 80,
    profitRatePercent: 8,
    platformFeeRatePercent: 1,
    serviceFeeRatePercent: 0,
    ...overrides,
  };
}

describe("buildFinancingInvoiceRows", () => {
  it("keeps the invoice card while the issuer still needs to act", () => {
    const rows = buildFinancingInvoiceRows([invoice()], [note()], () => true);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("invoice");
  });

  it("shows the note instead of the invoice once the offer is done", () => {
    const rows = buildFinancingInvoiceRows([invoice()], [note()], () => false);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("note");
    if (rows[0]?.kind === "note") expect(rows[0].note.id).toBe("note_1");
  });

  it("adds facility-linked notes that are missing from the invoice list", () => {
    const facilityNote = note({
      id: "note_fac",
      sourceInvoiceId: "inv_facility",
      sourceContractId: "con_1",
    });
    const rows = buildFinancingInvoiceRows([invoice()], [note(), facilityNote], () => false);
    expect(rows.map((row) => row.kind)).toEqual(["note", "note"]);
    expect(rows.map((row) => (row.kind === "note" ? row.note.id : row.invoice.id))).toEqual([
      "note_1",
      "note_fac",
    ]);
  });
});
