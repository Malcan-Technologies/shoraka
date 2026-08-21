import type { NoteListItem } from "@cashsouk/types";
import type { IssuerDashboardInvoice, IssuerDashboardNote } from "@/types/issuer-dashboard";
import { partitionInvoiceListRows } from "./financing-list-sections";
import type { FinancingInvoiceRow } from "./financing-invoice-rows";

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

function dashboardNote(overrides: Partial<IssuerDashboardNote> = {}): IssuerDashboardNote {
  return {
    id: "note_1",
    noteReference: "NOTE-1",
    noteStatus: "ACTIVE",
    listingStatus: "PUBLISHED",
    noteListingStatus: null,
    fundingStatus: "FUNDED",
    servicingStatus: "CURRENT",
    targetAmount: "8000",
    fundedAmount: "8000",
    fundingProgressPercent: 100,
    minimumFundingPercent: "80",
    fundingDeadline: null,
    maturityDate: null,
    marketplaceStatusLabel: null,
    investorCount: 0,
    disbursementBreakdown: null,
    ...overrides,
  };
}

function listNote(overrides: Partial<NoteListItem> = {}): NoteListItem {
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

describe("partitionInvoiceListRows", () => {
  it("orders active, then funded, then funding now, then the rest", () => {
    const rows: FinancingInvoiceRow[] = [
      { kind: "invoice", id: "invoice:approved", invoice: invoice() },
      {
        kind: "note",
        id: "note:active",
        note: listNote({ id: "note_active", status: "ACTIVE" as NoteListItem["status"] }),
      },
      {
        kind: "invoice",
        id: "invoice:funded",
        invoice: invoice({
          id: "inv_funded",
          note: dashboardNote({
            id: "note_funded",
            noteStatus: "PUBLISHED",
            fundingStatus: "FUNDED",
            servicingStatus: "NOT_STARTED",
            fundingProgressPercent: 100,
          }),
        }),
      },
      {
        kind: "note",
        id: "note:funding",
        note: listNote({
          id: "note_funding",
          status: "FUNDING" as NoteListItem["status"],
          listingStatus: "PUBLISHED" as NoteListItem["listingStatus"],
          fundingStatus: "OPEN" as NoteListItem["fundingStatus"],
          servicingStatus: "NOT_STARTED" as NoteListItem["servicingStatus"],
          fundingPercent: 40,
          fundedAmount: 3200,
        }),
      },
    ];

    const sections = partitionInvoiceListRows(rows);
    expect(sections.active.map((row) => row.id)).toEqual(["note:active"]);
    expect(sections.funded.map((row) => row.id)).toEqual(["invoice:funded"]);
    expect(sections.fundingNow.map((row) => row.id)).toEqual(["note:funding"]);
    expect(sections.other.map((row) => row.id)).toEqual(["invoice:approved"]);
  });
});
