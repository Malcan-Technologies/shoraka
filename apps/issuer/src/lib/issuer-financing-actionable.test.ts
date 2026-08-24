jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

jest.mock("@cashsouk/ui", () => ({
  isNoteFullySettled: () => false,
}));

import type { NoteListItem } from "@cashsouk/types";
import type { IssuerDashboardContract, IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import {
  buildIssuerFinancingPendingAction,
  isIssuerNoteActionable,
} from "./issuer-financing-actionable";

function contract(overrides: Partial<IssuerDashboardContract> = {}): IssuerDashboardContract {
  return {
    id: "con_1",
    displayReference: "CON-ARF-1",
    applicationId: "app_1",
    productId: "prod_1",
    contractForModal: { status: "APPROVED", contract_details: { number: "FAC-100" } },
    title: "Supply agreement",
    productName: "Facility financing",
    customerName: "Acme",
    contractStartDate: "2026-01-01",
    contractEndDate: "2026-12-31",
    approvedFacilityAmount: "500000",
    utilizedFacilityAmount: "0",
    availableFacilityAmount: "500000",
    facilityFeeCapAmount: "5000",
    facilityFeePaidAmount: "0",
    facilityFeeRemainingAmount: "5000",
    activeNotesCount: 0,
    contractStatus: "APPROVED",
    actionRequiredApplicationIds: [],
    invoiceStats: {
      total: 0,
      approved: 0,
      rejected: 0,
      unfinanced: 0,
      fundingInProgress: 0,
      activeNotes: 0,
      completedNotes: 0,
      unsuccessfulRaise: 0,
      disputedNotes: null,
    },
    ...overrides,
  };
}

function invoice(overrides: Partial<IssuerDashboardInvoice> = {}): IssuerDashboardInvoice {
  return {
    id: "inv_1",
    displayReference: "INV-1",
    applicationId: "app_1",
    productId: "prod_1",
    productName: "Account Receivable (AR) Financing",
    contractId: "con_1",
    invoiceForModal: { status: "OFFER_SENT", offer_details: {} },
    invoiceStatus: "OFFER_SENT",
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
    sourceInvoiceId: null,
    issuerOrganizationId: "org_1",
    issuerName: null,
    paymasterName: "Acme",
    riskRating: null,
    status: "REPAID" as NoteListItem["status"],
    listingStatus: "CLOSED" as NoteListItem["listingStatus"],
    fundingStatus: "FUNDED" as NoteListItem["fundingStatus"],
    servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    investorCount: 1,
    maturityDate: "2026-01-01",
    listingClosesAt: null,
    activatedAt: null,
    publishedAt: null,
    fundingClosedAt: null,
    repaidAt: "2026-08-01",
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
    excessLateCharges: {
      owed: 250,
      paid: 0,
      outstanding: 250,
      noteReference: "NOTE-1",
    },
    ...overrides,
  };
}

describe("buildIssuerFinancingPendingAction", () => {
  it("keeps the actions-required title and names the fee, not the facility size", () => {
    const action = buildIssuerFinancingPendingAction({
      contracts: [
        contract({
          facilityFeeUpfrontAmount: 2500,
          facilityFeeUpfrontOutstanding: 2500,
          facilityFeeRemainingAmount: "3000",
        }),
      ],
      invoices: [],
      notes: [],
    });
    expect(action).toMatchObject({
      count: 1,
      title: "1 action required",
      description: "RM 2,500.00 is due now. RM 500.00 will be collected from later drawdowns.",
      href: "/financing/contracts/con_1",
      ctaLabel: "Pay facility fee",
      uniqueCount: 1,
    });
    expect(action?.description).not.toContain("500,000");
    expect(action?.description).not.toContain("Needs attention: 1 facility");
  });

  it("does not treat an offer already shown on applications as unique financing work", () => {
    const action = buildIssuerFinancingPendingAction({
      contracts: [
        contract({
          contractStatus: "OFFER_SENT",
          contractForModal: {
            status: "OFFER_SENT",
            offer_details: { offered_facility: 500000 },
          },
        }),
      ],
      invoices: [],
      notes: [],
    });
    expect(action?.count).toBe(1);
    expect(action?.uniqueCount).toBe(0);
    expect(action?.uniqueDescription).toBeNull();
    expect(action?.description).toBe("Needs attention: 1 facility.");
  });

  it("lists every financing attention item and still names the outstanding fee once", () => {
    const action = buildIssuerFinancingPendingAction({
      contracts: [
        contract({
          facilityFeeUpfrontAmount: 2500,
          facilityFeeUpfrontOutstanding: 2500,
          facilityFeeRemainingAmount: "3000",
        }),
      ],
      invoices: [invoice()],
      notes: [],
    });
    expect(action).toMatchObject({
      count: 2,
      title: "2 actions required",
      ctaLabel: "View financing",
      uniqueCount: 1,
    });
    expect(action?.description).toBe(
      "Needs attention: 1 facility, 1 invoice. RM 2,500.00 is due now. RM 500.00 will be collected from later drawdowns."
    );
    expect(action?.uniqueDescription).toBe(
      "RM 2,500.00 is due now. RM 500.00 will be collected from later drawdowns."
    );
  });

  it("sends the issuer to the note late-charge card when only late charges are due", () => {
    const action = buildIssuerFinancingPendingAction({
      contracts: [],
      invoices: [],
      notes: [note()],
    });
    expect(action).toMatchObject({
      count: 1,
      title: "1 action required",
      href: "/financing/notes/note_1#late-charges",
      ctaLabel: "Pay outstanding late charges",
      uniqueCount: 1,
    });
  });
});

describe("isIssuerNoteActionable", () => {
  const now = new Date("2026-08-24T04:00:00.000Z");

  it("does not treat Malaysia maturity day as already past due", () => {
    expect(
      isIssuerNoteActionable(
        note({
          status: "ACTIVE" as NoteListItem["status"],
          servicingStatus: "CURRENT" as NoteListItem["servicingStatus"],
          maturityDate: "2026-08-24T00:00:00.000Z",
          excessLateCharges: null,
        }),
        now
      )
    ).toBe(false);
  });

  it("flags an active note after the Malaysia maturity calendar day", () => {
    expect(
      isIssuerNoteActionable(
        note({
          status: "ACTIVE" as NoteListItem["status"],
          servicingStatus: "CURRENT" as NoteListItem["servicingStatus"],
          maturityDate: "2026-08-23T00:00:00.000Z",
          excessLateCharges: null,
        }),
        now
      )
    ).toBe(true);
  });
});
