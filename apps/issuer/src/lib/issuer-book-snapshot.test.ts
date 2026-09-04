jest.mock("@cashsouk/config", () => ({
  getStatusPresentationByBadgeKey: () => ({ color: "bg-mock", label: "Mock" }),
  getStatusColorAndLabel: () => ({ color: "bg-mock", label: "Mock" }),
  resolveIssuerInvoiceStatusBadgeKey: (status: string | undefined) =>
    String(status ?? "draft").toLowerCase(),
}));

import type { NoteListItem } from "@cashsouk/types";
import type { NormalizedApplication } from "@/app/(application-management)/applications/status";
import type {
  IssuerDashboardContract,
  IssuerDashboardInvoice,
  IssuerDashboardNote,
} from "@/types/issuer-dashboard";
import {
  buildIssuerBookSnapshot,
  classifyLiveInvoice,
  formatRaisingDeadline,
  isFacilityExpired,
  isNoteRaisingNow,
  isOpenApplication,
} from "./issuer-book-snapshot";

function makeApp(overrides: Partial<NormalizedApplication> = {}): NormalizedApplication {
  return {
    id: "app_1",
    type: "Invoice financing",
    status: "SUBMITTED",
    cardStatus: {
      badgeKey: "submitted",
      displayLabel: "Submitted",
      showReviewOffer: false,
      showMakeAmendments: false,
    },
    contractTitle: null,
    contractId: null,
    customer: "Acme",
    applicationDate: "2026-08-01",
    submittedAt: "2026-08-01",
    contractValue: null,
    facilityApplied: null,
    offeredFacilityAmount: null,
    approvedFacility: "—",
    approvedFacilityAmount: null,
    facilityFeeRatePercent: null,
    facilityFeeCapAmount: null,
    facilityFeePaidAmount: null,
    updatedAt: "2026-08-01",
    invoices: [],
    contractStatus: null,
    signedContractOfferLetterAvailable: false,
    signedContractOfferLetterS3Key: null,
    applicationStatus: "SUBMITTED",
    canWithdraw: true,
    facilityInForceNoInvoices: false,
    ...overrides,
  };
}

const emptyInvoiceStats = {
  total: 0,
  approved: 0,
  rejected: 0,
  unfinanced: 0,
  fundingInProgress: 0,
  activeNotes: 0,
  completedNotes: 0,
  unsuccessfulRaise: 0,
  disputedNotes: null,
};

function makeContract(overrides: Partial<IssuerDashboardContract> = {}): IssuerDashboardContract {
  return {
    id: "con_1",
    displayReference: "CON-1",
    applicationId: "app_fac",
    productId: "prod_1",
    contractForModal: {},
    title: "Acme facility",
    productName: "Facility financing",
    customerName: "Acme",
    contractStartDate: "2026-01-01",
    contractEndDate: "2026-12-31",
    approvedFacilityAmount: "1200000",
    utilizedFacilityAmount: "780000",
    availableFacilityAmount: "420000",
    facilityFeeCapAmount: null,
    facilityFeePaidAmount: null,
    facilityFeeRemainingAmount: null,
    activeNotesCount: 0,
    contractStatus: "APPROVED",
    actionRequiredApplicationIds: [],
    invoiceStats: emptyInvoiceStats,
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<IssuerDashboardInvoice> = {}): IssuerDashboardInvoice {
  return {
    id: "inv_1",
    displayReference: "INV-1",
    applicationId: "app_1",
    productId: "prod_1",
    productName: "Account Receivable (AR) Financing",
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

function makeDashboardNote(overrides: Partial<IssuerDashboardNote> = {}): IssuerDashboardNote {
  return {
    id: "note_1",
    noteReference: "NOTE-1",
    noteStatus: "PUBLISHED",
    listingStatus: "PUBLISHED",
    noteListingStatus: null,
    fundingStatus: "OPEN",
    servicingStatus: "NOT_STARTED",
    targetAmount: "8000",
    fundedAmount: "4000",
    fundingProgressPercent: 50,
    minimumFundingPercent: "80",
    fundingDeadline: "2026-08-22T16:00:00.000Z",
    maturityDate: null,
    marketplaceStatusLabel: null,
    investorCount: 0,
    disbursementBreakdown: null,
    ...overrides,
  };
}

function makeNote(overrides: Partial<NoteListItem> = {}): NoteListItem {
  return {
    id: "note_1",
    noteReference: "NOTE-1",
    title: "Acme invoice note",
    productCategory: null,
    productName: "Invoice financing",
    issuerIndustry: null,
    sourceApplicationId: "app_1",
    sourceApplicationDisplayReference: null,
    sourceContractId: null,
    sourceContractDisplayReference: null,
    sourceInvoiceId: "inv_1",
    sourceInvoiceDisplayReference: null,
    issuerOrganizationId: "org_1",
    issuerOrganizationDisplayReference: null,
    issuerName: null,
    paymasterName: "Acme",
    riskRating: null,
    status: "PUBLISHED" as NoteListItem["status"],
    listingStatus: "PUBLISHED" as NoteListItem["listingStatus"],
    fundingStatus: "OPEN" as NoteListItem["fundingStatus"],
    servicingStatus: "NOT_STARTED" as NoteListItem["servicingStatus"],
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    investorCount: 0,
    maturityDate: null,
    listingClosesAt: "2026-08-22T16:00:00.000Z",
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
    fundedAmount: 4000,
    fundingPercent: 50,
    minimumFundingPercent: 80,
    profitRatePercent: 8,
    platformFeeRatePercent: 1,
    serviceFeeRatePercent: 0,
    ...overrides,
  };
}

const now = new Date(2026, 7, 20);

describe("isOpenApplication", () => {
  it("keeps draft, review, and action states", () => {
    expect(
      isOpenApplication(
        makeApp({
          cardStatus: {
            badgeKey: "draft",
            displayLabel: "Draft",
            showReviewOffer: false,
            showMakeAmendments: false,
          },
        })
      )
    ).toBe(true);
    expect(isOpenApplication(makeApp())).toBe(true);
  });

  it("excludes closed and expired applications", () => {
    expect(
      isOpenApplication(
        makeApp({
          cardStatus: {
            badgeKey: "completed",
            displayLabel: "Completed",
            showReviewOffer: false,
            showMakeAmendments: false,
          },
        })
      )
    ).toBe(false);
    expect(
      isOpenApplication(
        makeApp({
          cardStatus: {
            badgeKey: "offer_expired",
            displayLabel: "Offer Expired",
            showReviewOffer: false,
            showMakeAmendments: false,
          },
        })
      )
    ).toBe(false);
  });
});

describe("isNoteRaisingNow", () => {
  it("requires a published listing that is still open", () => {
    expect(isNoteRaisingNow({ listingStatus: "PUBLISHED", fundingStatus: "OPEN" })).toBe(true);
    expect(isNoteRaisingNow({ listingStatus: "PUBLISHED", fundingStatus: "FUNDED" })).toBe(false);
    expect(isNoteRaisingNow({ listingStatus: "NOT_LISTED", fundingStatus: "OPEN" })).toBe(false);
  });
});

describe("isFacilityExpired", () => {
  it("uses the local calendar day", () => {
    expect(isFacilityExpired("2026-08-19", now)).toBe(true);
    expect(isFacilityExpired("2026-08-20", now)).toBe(false);
    expect(isFacilityExpired(null, now)).toBe(false);
  });
});

describe("classifyLiveInvoice", () => {
  it("skips draft and rejected, and marks repaid notes", () => {
    expect(classifyLiveInvoice(makeInvoice({ invoiceStatus: "DRAFT" }), null)).toBeNull();
    expect(classifyLiveInvoice(makeInvoice({ invoiceStatus: "REJECTED" }), null)).toBeNull();
    expect(
      classifyLiveInvoice(
        makeInvoice(),
        makeDashboardNote({
          noteStatus: "REPAID",
          fundingStatus: "FUNDED",
          servicingStatus: "SETTLED",
        })
      )
    ).toBe("repaid");
  });

  it("splits raising, servicing, approved-not-listed, and in review", () => {
    expect(classifyLiveInvoice(makeInvoice(), makeDashboardNote())).toBe("raisingNow");
    expect(
      classifyLiveInvoice(
        makeInvoice(),
        makeDashboardNote({
          noteStatus: "ACTIVE",
          fundingStatus: "FUNDED",
          servicingStatus: "CURRENT",
        })
      )
    ).toBe("servicing");
    expect(classifyLiveInvoice(makeInvoice({ invoiceStatus: "APPROVED" }), null)).toBe(
      "approvedNotListed"
    );
    expect(
      classifyLiveInvoice(
        makeInvoice({ invoiceStatus: "APPROVED" }),
        makeDashboardNote({
          noteStatus: "DRAFT",
          listingStatus: "NOT_LISTED",
          fundingStatus: "NOT_OPEN",
        })
      )
    ).toBe("approvedNotListed");
    expect(classifyLiveInvoice(makeInvoice({ invoiceStatus: "SUBMITTED" }), null)).toBe("inReview");
  });
});

describe("formatRaisingDeadline", () => {
  it("labels a future close and a past close", () => {
    expect(formatRaisingDeadline("2026-08-22T16:00:00.000Z", now)).toMatch(/^closes /);
    expect(formatRaisingDeadline("2026-08-01T16:00:00.000Z", now)).toMatch(/^closed /);
    expect(formatRaisingDeadline(null, now)).toBeNull();
  });
});

describe("buildIssuerBookSnapshot", () => {
  it("returns an empty snapshot when nothing is in play", () => {
    const snapshot = buildIssuerBookSnapshot({
      applications: [
        makeApp({
          cardStatus: {
            badgeKey: "completed",
            displayLabel: "Completed",
            showReviewOffer: false,
            showMakeAmendments: false,
          },
        }),
      ],
      contracts: [],
      invoices: [],
      notes: [],
      now,
    });
    expect(snapshot.isEmpty).toBe(true);
    expect(snapshot.facilityBook).toBeNull();
    expect(snapshot.invoiceBook).toBeNull();
    expect(snapshot.raisingNow).toBeNull();
  });

  it("treats drafts-only issuers as incoming work without books", () => {
    const snapshot = buildIssuerBookSnapshot({
      applications: [
        makeApp({
          id: "draft_1",
          status: "DRAFT",
          cardStatus: {
            badgeKey: "draft",
            displayLabel: "Draft",
            showReviewOffer: false,
            showMakeAmendments: false,
          },
        }),
      ],
      contracts: [],
      invoices: [],
      notes: [],
      now,
    });
    expect(snapshot.draftsOnly).toBe(true);
    expect(snapshot.incoming.openCount).toBe(1);
    expect(snapshot.incoming.draftCount).toBe(1);
    expect(snapshot.facilityBook).toBeNull();
    expect(snapshot.invoiceBook).toBeNull();
  });

  it("splits open applications into needs you, CashSouk, and drafts", () => {
    const snapshot = buildIssuerBookSnapshot({
      applications: [
        makeApp({
          id: "act",
          cardStatus: {
            badgeKey: "offer_sent",
            displayLabel: "Offer Received",
            showReviewOffer: true,
            showMakeAmendments: false,
          },
        }),
        makeApp({ id: "wait" }),
        makeApp({
          id: "draft",
          cardStatus: {
            badgeKey: "draft",
            displayLabel: "Draft",
            showReviewOffer: false,
            showMakeAmendments: false,
          },
        }),
        makeApp({
          id: "done",
          cardStatus: {
            badgeKey: "rejected",
            displayLabel: "Rejected",
            showReviewOffer: false,
            showMakeAmendments: false,
          },
        }),
      ],
      contracts: [],
      invoices: [],
      notes: [],
      now,
    });
    expect(snapshot.incoming).toEqual({
      openCount: 3,
      needsYouCount: 1,
      withCashSoukCount: 1,
      draftCount: 1,
    });
  });

  it("excludes invoice-only holder contracts from the facility book", () => {
    const snapshot = buildIssuerBookSnapshot({
      applications: [makeApp({ id: "inv_only", type: "Invoice financing", contractId: "holder" })],
      contracts: [
        makeContract({
          id: "holder",
          applicationId: "inv_only",
          approvedFacilityAmount: "999999",
          utilizedFacilityAmount: null,
          availableFacilityAmount: null,
          contractStatus: "APPROVED",
        }),
      ],
      invoices: [makeInvoice({ id: "stand", contractId: null, invoiceStatus: "SUBMITTED" })],
      notes: [],
      now,
    });
    expect(snapshot.facilityBook).toBeNull();
    expect(snapshot.invoiceBook?.invoices.total).toBe(1);
    expect(snapshot.invoiceBook?.invoices.inReview).toBe(1);
  });

  it("counts approved facilities and nests invoices under them", () => {
    const snapshot = buildIssuerBookSnapshot({
      applications: [
        makeApp({
          id: "app_fac",
          type: "Facility financing",
          contractId: "con_1",
          cardStatus: {
            badgeKey: "completed",
            displayLabel: "Completed",
            showReviewOffer: false,
            showMakeAmendments: false,
          },
        }),
      ],
      contracts: [makeContract()],
      invoices: [
        makeInvoice({
          id: "under",
          contractId: "con_1",
          invoiceStatus: "APPROVED",
        }),
        makeInvoice({
          id: "stand",
          contractId: null,
          invoiceStatus: "APPROVED",
        }),
        makeInvoice({
          id: "rejected",
          contractId: "con_1",
          invoiceStatus: "REJECTED",
        }),
      ],
      notes: [],
      now,
    });

    expect(snapshot.facilityBook).toMatchObject({
      facilityCount: 1,
      activeCount: 1,
      closedCount: 0,
      approvedAmount: 1_200_000,
      availableAmount: 420_000,
      invoices: {
        total: 1,
        approvedNotListed: 1,
      },
    });
    expect(snapshot.invoiceBook?.invoices.total).toBe(1);
    expect(snapshot.invoiceBook?.invoices.approvedNotListed).toBe(1);
  });

  it("keeps reserved pending separate and uses available that already subtracts it", () => {
    const snapshot = buildIssuerBookSnapshot({
      applications: [makeApp({ type: "Facility financing", contractId: "con_1" })],
      contracts: [
        makeContract({
          approvedFacilityAmount: "100000",
          utilizedFacilityAmount: "40000",
          pendingFacilityAmount: "15000",
          availableFacilityAmount: "45000",
          lifetimeCapAmount: "500000",
          lifetimeUsedAmount: "120000",
          lifetimeRemainingAmount: "380000",
        }),
      ],
      invoices: [],
      notes: [],
      now,
    });
    expect(snapshot.facilityBook).toMatchObject({
      approvedAmount: 100_000,
      utilizedAmount: 40_000,
      pendingAmount: 15_000,
      availableAmount: 45_000,
      lifetimeUsedAmount: 120_000,
      lifetimeRemainingAmount: 380_000,
    });
  });

  it("keeps repaid facility invoices visible without counting them as live draws", () => {
    const snapshot = buildIssuerBookSnapshot({
      applications: [
        makeApp({
          id: "app_fac",
          type: "Facility financing",
          contractId: "con_1",
          cardStatus: {
            badgeKey: "completed",
            displayLabel: "Completed",
            showReviewOffer: false,
            showMakeAmendments: false,
          },
        }),
      ],
      contracts: [makeContract()],
      invoices: [
        makeInvoice({
          id: "repaid_inv",
          contractId: "con_1",
          invoiceStatus: "APPROVED",
          note: makeDashboardNote({
            id: "repaid_note",
            noteStatus: "REPAID",
            fundingStatus: "FUNDED",
            servicingStatus: "SETTLED",
          }),
        }),
      ],
      notes: [],
      now,
    });

    expect(snapshot.facilityBook?.invoices.total).toBe(0);
    expect(snapshot.facilityBook?.invoices.repaid).toBe(1);
  });

  it("excludes normalized invoice_only apps that no longer carry a holder contractId", () => {
    const snapshot = buildIssuerBookSnapshot({
      applications: [makeApp({ id: "inv_only", type: "Invoice financing", contractId: null })],
      contracts: [
        makeContract({
          id: "holder",
          applicationId: "inv_only",
          approvedFacilityAmount: null,
          contractStatus: "DRAFT",
        }),
      ],
      invoices: [makeInvoice({ id: "stand", contractId: null, invoiceStatus: "OFFER_SENT" })],
      notes: [],
      now,
    });
    expect(snapshot.facilityBook).toBeNull();
    expect(snapshot.invoiceBook?.invoices.inReview).toBe(1);
  });

  it("treats invoices on a holder contract as standalone", () => {
    const snapshot = buildIssuerBookSnapshot({
      applications: [makeApp({ type: "Invoice financing", contractId: "holder" })],
      contracts: [
        makeContract({
          id: "holder",
          approvedFacilityAmount: null,
          contractStatus: "DRAFT",
        }),
      ],
      invoices: [makeInvoice({ contractId: "holder", invoiceStatus: "APPROVED" })],
      notes: [],
      now,
    });
    expect(snapshot.facilityBook).toBeNull();
    expect(snapshot.invoiceBook?.invoices.approvedNotListed).toBe(1);
  });

  it("marks a facility closed after its end date and ignores rejected facilities", () => {
    const snapshot = buildIssuerBookSnapshot({
      applications: [
        makeApp({ id: "a", type: "Facility financing", contractId: "closed" }),
        makeApp({ id: "b", type: "Facility financing", contractId: "rejected" }),
      ],
      contracts: [
        makeContract({
          id: "closed",
          contractEndDate: "2026-08-19",
          availableFacilityAmount: "0",
          utilizedFacilityAmount: "1200000",
        }),
        makeContract({
          id: "rejected",
          contractStatus: "REJECTED",
          approvedFacilityAmount: "500000",
        }),
      ],
      invoices: [],
      notes: [],
      now,
    });
    expect(snapshot.facilityBook).toMatchObject({
      facilityCount: 1,
      activeCount: 0,
      closedCount: 1,
    });
  });

  it("keeps an accepted line in the facility book while the facility itself is in amendment", () => {
    const snapshot = buildIssuerBookSnapshot({
      applications: [makeApp({ id: "app_fac", type: "Facility financing", contractId: "con_1" })],
      contracts: [
        makeContract({
          contractStatus: "AMENDMENT_REQUESTED",
          approvedFacilityAmount: "RM 1,200,000.00",
        }),
      ],
      invoices: [],
      notes: [],
      now,
    });
    expect(snapshot.facilityBook).toMatchObject({
      facilityCount: 1,
      approvedAmount: 1_200_000,
    });
  });

  it("builds a raising-now pulse from published open notes", () => {
    const snapshot = buildIssuerBookSnapshot({
      applications: [],
      contracts: [],
      invoices: [
        makeInvoice({
          id: "inv_1",
          note: makeDashboardNote({ id: "note_1", targetAmount: "8000", fundedAmount: "3000" }),
        }),
        makeInvoice({
          id: "inv_2",
          note: makeDashboardNote({
            id: "note_2",
            targetAmount: "4000",
            fundedAmount: "1500",
            fundingDeadline: "2026-08-21T08:00:00.000Z",
          }),
        }),
      ],
      notes: [
        makeNote({
          id: "note_1",
          sourceInvoiceId: "inv_1",
          targetAmount: 8000,
          fundedAmount: 3000,
        }),
        makeNote({
          id: "note_2",
          sourceInvoiceId: "inv_2",
          targetAmount: 4000,
          fundedAmount: 1500,
          listingClosesAt: "2026-08-21T08:00:00.000Z",
        }),
      ],
      now,
    });
    expect(snapshot.raisingNow).toEqual({
      noteCount: 2,
      fundedAmount: 4500,
      targetAmount: 12000,
      nearestDeadline: "2026-08-21T08:00:00.000Z",
    });
    expect(snapshot.invoiceBook?.invoices.raisingNow).toBe(2);
  });
});
