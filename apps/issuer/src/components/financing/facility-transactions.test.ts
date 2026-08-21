import { InvoiceStatus } from "@cashsouk/types";
import type { ApplicationLogEntry } from "@/hooks/use-application-logs";
import type { IssuerDashboardContract, IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import {
  buildFacilityTransactions,
  uniqueFacilityApplicationIds,
  type FacilityTransactionNoteInput,
} from "./facility-transactions";

function contract(
  overrides: Partial<IssuerDashboardContract> = {}
): IssuerDashboardContract {
  return {
    id: "con_1",
    displayReference: "CON-1",
    applicationId: "app_facility",
    productId: "prod_1",
    contractForModal: {
      id: "con_1",
      application_id: "app_facility",
      issuer_organization_id: "org_1",
      status: "APPROVED",
      offer_details: {
        requested_facility: 100000,
        offered_facility: 80000,
        sent_at: "2026-07-01T10:00:00.000Z",
        responded_at: "2026-07-02T10:00:00.000Z",
        sent_by_user_id: null,
        responded_by_user_id: null,
        version: 1,
      },
      created_at: "2026-06-01T10:00:00.000Z",
      updated_at: "2026-07-02T10:00:00.000Z",
    },
    title: "Acme facility",
    productName: "Facility financing",
    customerName: "Acme",
    contractStartDate: "2026-07-01",
    contractEndDate: "2027-07-01",
    approvedFacilityAmount: "80000",
    utilizedFacilityAmount: "8000",
    availableFacilityAmount: "72000",
    facilityFeeCapAmount: null,
    facilityFeePaidAmount: null,
    facilityFeeRemainingAmount: null,
    activeNotesCount: 0,
    contractStatus: "APPROVED",
    actionRequiredApplicationIds: [],
    invoiceStats: {
      total: 1,
      approved: 1,
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

function invoice(
  overrides: Partial<IssuerDashboardInvoice> = {}
): IssuerDashboardInvoice {
  return {
    id: "inv_1",
    displayReference: "INV-1",
    applicationId: "app_invoice",
    productId: "prod_1",
    contractId: "con_1",
    invoiceForModal: {
      id: "inv_1",
      application_id: "app_invoice",
      status: InvoiceStatus.SUBMITTED,
      details: { number: "INV-100", value: 10000, maturity_date: "2026-12-01" },
      created_at: "2026-08-01T09:00:00.000Z",
      updated_at: "2026-08-01T09:00:00.000Z",
    },
    invoiceStatus: InvoiceStatus.SUBMITTED,
    invoiceNumber: "INV-100",
    customerName: "Acme",
    invoiceValue: "10000",
    financingAmount: "8000",
    submissionDate: "2026-08-01T09:00:00.000Z",
    note: null,
    actionRequiredApplicationIds: [],
    ...overrides,
  };
}

function note(
  overrides: Partial<FacilityTransactionNoteInput> = {}
): FacilityTransactionNoteInput {
  return {
    id: "note_1",
    noteReference: "NOTE-1",
    sourceInvoiceId: "inv_1",
    sourceContractId: "con_1",
    publishedAt: null,
    fundingClosedAt: null,
    activatedAt: null,
    repaidAt: null,
    fundingStatus: "OPEN",
    fundedAmount: 8000,
    ...overrides,
  };
}

function log(overrides: Partial<ApplicationLogEntry> = {}): ApplicationLogEntry {
  return {
    id: "log_1",
    event_type: "CONTRACT_OFFER_SENT",
    created_at: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("buildFacilityTransactions", () => {
  it("shows funding requested from the invoice submission", () => {
    const rows = buildFacilityTransactions({
      contract: contract(),
      invoices: [invoice()],
    });
    expect(rows.some((row) => row.label === "Funding requested" && row.amount === 8000)).toBe(
      true
    );
  });

  it("shows funding approved once the invoice is approved", () => {
    const rows = buildFacilityTransactions({
      contract: contract(),
      invoices: [
        invoice({
          invoiceStatus: InvoiceStatus.APPROVED,
          invoiceForModal: {
            id: "inv_1",
            application_id: "app_invoice",
            status: InvoiceStatus.APPROVED,
            details: { number: "INV-100", value: 10000, maturity_date: "2026-12-01" },
            offer_details: {
              requested_amount: 8000,
              offered_amount: 8000,
              requested_ratio_percent: 80,
              offered_ratio_percent: 80,
              offered_profit_rate_percent: 8,
              sent_at: "2026-08-03T09:00:00.000Z",
              responded_at: "2026-08-04T09:00:00.000Z",
              sent_by_user_id: null,
              responded_by_user_id: null,
              version: 1,
            },
            created_at: "2026-08-01T09:00:00.000Z",
            updated_at: "2026-08-05T09:00:00.000Z",
          },
        }),
      ],
    });
    expect(rows.map((row) => row.label)).toEqual(
      expect.arrayContaining(["Funding requested", "Funding approved", "Invoice offer sent"])
    );
  });

  it("does not duplicate a facility offer already present in application logs", () => {
    const rows = buildFacilityTransactions({
      contract: contract(),
      invoices: [],
      logs: [log({ event_type: "CONTRACT_OFFER_SENT" })],
    });
    const offerSent = rows.filter((row) => row.label === "Facility offer sent");
    expect(offerSent).toHaveLength(1);
    expect(offerSent[0]?.id).toBe("log:log_1");
  });

  it("adds funding opened and disbursed from note timestamps", () => {
    const rows = buildFacilityTransactions({
      contract: contract(),
      invoices: [invoice({ invoiceStatus: InvoiceStatus.APPROVED })],
      notes: [
        note({
          publishedAt: "2026-08-10T09:00:00.000Z",
          activatedAt: "2026-08-20T09:00:00.000Z",
          fundedAmount: 7500,
        }),
      ],
    });
    expect(rows.find((row) => row.label === "Funding opened")?.amount).toBe(7500);
    expect(rows.find((row) => row.label === "Disbursed")?.amount).toBe(7500);
  });

  it("uses disbursement breakdown amount when the note is activated", () => {
    const rows = buildFacilityTransactions({
      contract: contract(),
      invoices: [
        invoice({
          invoiceStatus: InvoiceStatus.APPROVED,
          note: {
            id: "note_1",
            noteReference: "NOTE-1",
            noteStatus: "ACTIVE",
            listingStatus: "CLOSED",
            noteListingStatus: null,
            fundingStatus: "FUNDED",
            servicingStatus: "CURRENT",
            targetAmount: "8000",
            fundedAmount: "8000",
            fundingProgressPercent: 100,
            minimumFundingPercent: "80",
            fundingDeadline: "2026-08-15T09:00:00.000Z",
            maturityDate: null,
            marketplaceStatusLabel: null,
            investorCount: 3,
            disbursementBreakdown: {
              grossFundedAmount: "8000",
              platformFeeAmount: "80",
              facilityFeeCharged: "40",
              netIssuerDisbursement: "7880",
            },
          },
        }),
      ],
      notes: [note({ activatedAt: "2026-08-20T09:00:00.000Z" })],
    });
    const disbursed = rows.filter((row) => row.label === "Disbursed");
    expect(disbursed).toHaveLength(1);
    expect(disbursed[0]?.amount).toBe(7880);
    expect(rows.find((row) => row.label === "Facility fee charged")?.amount).toBe(40);
  });

  it("sorts newest first", () => {
    const rows = buildFacilityTransactions({
      contract: contract(),
      invoices: [invoice()],
    });
    const times = rows.map((row) => (row.at ? Date.parse(row.at) : 0));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});

describe("uniqueFacilityApplicationIds", () => {
  it("collects the facility application and each invoice application", () => {
    expect(uniqueFacilityApplicationIds(contract(), [invoice()])).toEqual([
      "app_facility",
      "app_invoice",
    ]);
  });
});
