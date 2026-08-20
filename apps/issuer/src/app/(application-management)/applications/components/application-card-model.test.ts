import type { NormalizedApplication, NormalizedInvoice } from "../status";
import {
  applicationAttentionHeadline,
  applicationCardSubStatus,
  applicationHeadlineAmount,
  getApplicationCardPrimaryAction,
  type ApplicationCardPrimaryAction,
} from "./application-card-model";

jest.mock("@cashsouk/config", () => ({
  formatCurrency: (value: number) => `RM ${value}`,
  resolveOfferedAmount: (offer: { offered_amount?: number } | null | undefined) => {
    const value = offer?.offered_amount;
    return typeof value === "number" && value > 0 ? value : 0;
  },
  getStatusPresentationByBadgeKey: () => ({ color: "bg-mock", label: "Mock" }),
  getStatusColorAndLabel: () => ({ color: "bg-mock", label: "Mock" }),
  resolveIssuerInvoiceStatusBadgeKey: (status: string | undefined) =>
    String(status ?? "draft").toLowerCase(),
  badgeKeyToStatusToken: () => "action",
}));

function makeApp(overrides: Partial<NormalizedApplication> = {}): NormalizedApplication {
  return {
    id: "app_1",
    type: "Invoice financing",
    status: "SUBMITTED",
    cardStatus: {
      badgeKey: "offer_sent",
      displayLabel: "Offer Received",
      showReviewOffer: true,
      showMakeAmendments: false,
    },
    contractTitle: null,
    contractId: null,
    customer: "Acme Trading",
    applicationDate: "2026-08-01",
    submittedAt: "2026-08-01",
    contractValue: null,
    facilityApplied: 125000,
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
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<NormalizedInvoice> = {}): NormalizedInvoice {
  return {
    id: "inv_1",
    number: "INV-1",
    contractId: null,
    maturityDate: null,
    value: 30,
    appliedFinancing: 25,
    offeredAmount: null,
    document: "invoice.pdf",
    documentS3Key: null,
    financingOffered: "—",
    platformFee: "—",
    profitRate: "—",
    status: "SUBMITTED",
    offerStatus: null,
    canReviewOffer: false,
    signedOfferLetterAvailable: false,
    signedOfferLetterS3Key: null,
    reasonOrRemarks: null,
    ...overrides,
  };
}

describe("applicationHeadlineAmount", () => {
  it("shows requested financing, not contract value", () => {
    expect(applicationHeadlineAmount(makeApp({ facilityApplied: 10 }))).toBe("RM 10");
    expect(
      applicationHeadlineAmount(makeApp({ facilityApplied: null, contractValue: 20 }))
    ).toBe("—");
    expect(
      applicationHeadlineAmount(
        makeApp({
          facilityApplied: null,
          contractValue: 20,
          invoices: [makeInvoice({ appliedFinancing: 25 })],
        })
      )
    ).toBe("RM 25");
  });

  it("uses only outstanding invoice offers, not already-approved ones", () => {
    expect(
      applicationHeadlineAmount(
        makeApp({
          type: "Facility financing",
          contractValue: 500_000_000,
          facilityApplied: 500_000_000,
          approvedFacilityAmount: 100_000,
          contractStatus: "APPROVED",
          invoices: [
            makeInvoice({
              id: "inv_approved",
              status: "APPROVED",
              appliedFinancing: 213_860,
              offeredAmount: 205_190,
            }),
            makeInvoice({
              id: "inv_offer",
              status: "OFFER_SENT",
              offerStatus: "Offer received",
              canReviewOffer: true,
              appliedFinancing: 46_172,
              offeredAmount: 40_740,
            }),
          ],
        })
      )
    ).toBe("RM 40740");
  });

  it("shows the invoice financing offer instead of contract value", () => {
    expect(
      applicationHeadlineAmount(
        makeApp({
          type: "Facility financing",
          contractValue: 2_500_000,
          facilityApplied: 2_000_000,
          approvedFacilityAmount: 1_800_000,
          contractStatus: "APPROVED",
          invoices: [
            makeInvoice({
              status: "OFFER_SENT",
              offerStatus: "Offer received",
              canReviewOffer: true,
              appliedFinancing: 25,
              offeredAmount: 18,
            }),
          ],
        })
      )
    ).toBe("RM 18");
  });

  it("shows the offered facility while a facility offer is outstanding", () => {
    expect(
      applicationHeadlineAmount(
        makeApp({
          type: "Facility financing",
          contractStatus: "OFFER_SENT",
          contractValue: 2_500_000,
          facilityApplied: 2_000_000,
          offeredFacilityAmount: 1_500_000,
        })
      )
    ).toBe("RM 1500000");
  });

  it("shows offered invoice financing on invoice-only applications", () => {
    expect(
      applicationHeadlineAmount(
        makeApp({
          type: "Invoice financing",
          facilityApplied: null,
          contractValue: null,
          invoices: [
            makeInvoice({
              status: "OFFER_SENT",
              offerStatus: "Offer received",
              canReviewOffer: true,
              appliedFinancing: 25,
              offeredAmount: 22,
            }),
          ],
        })
      )
    ).toBe("RM 22");
  });

  it("shows requested financing on invoices that need amendment, not the approved facility", () => {
    expect(
      applicationHeadlineAmount(
        makeApp({
          type: "Facility financing",
          status: "AMENDMENT_REQUESTED",
          cardStatus: {
            badgeKey: "amendment_requested",
            displayLabel: "Action Required",
            showReviewOffer: false,
            showMakeAmendments: true,
          },
          contractStatus: "APPROVED",
          contractValue: 500_000_000,
          facilityApplied: 500_000_000,
          approvedFacilityAmount: 100_000,
          invoices: [
            makeInvoice({
              id: "inv_approved",
              status: "APPROVED",
              appliedFinancing: 213_860,
              offeredAmount: 205_190,
            }),
            makeInvoice({
              id: "inv_amend",
              status: "AMENDMENT_REQUESTED",
              value: 5_000_000,
              appliedFinancing: 3_800_000,
            }),
          ],
        })
      )
    ).toBe("RM 3800000");
  });

  it("shows the approved facility once the line is in force and no invoice offer is pending", () => {
    expect(
      applicationHeadlineAmount(
        makeApp({
          type: "Facility financing",
          contractStatus: "APPROVED",
          cardStatus: {
            badgeKey: "completed",
            displayLabel: "Completed",
            showReviewOffer: false,
            showMakeAmendments: false,
          },
          contractValue: 2_500_000,
          facilityApplied: 2_000_000,
          approvedFacilityAmount: 1_800_000,
          invoices: [makeInvoice({ status: "APPROVED", appliedFinancing: 25, offeredAmount: 18 })],
        })
      )
    ).toBe("RM 1800000");
  });
});

describe("applicationCardSubStatus", () => {
  it("counts invoices that need amendment or were rejected", () => {
    expect(
      applicationCardSubStatus(
        makeApp({
          invoices: [makeInvoice({ status: "AMENDMENT_REQUESTED" })],
        })
      )
    ).toBe("1 invoice · 1 needs action");
  });
});

describe("getApplicationCardPrimaryAction", () => {
  it("sends offer review to the offer tab", () => {
    const action = getApplicationCardPrimaryAction(makeApp());
    expect(action.kind).toBe("reviewOffer");
    expect(action.href).toBe("/applications/app_1?tab=offer");
    expect(action.label).toBe("Review Invoice Offer");
  });

  it("uses facility wording for contract offers", () => {
    const action = getApplicationCardPrimaryAction(
      makeApp({ type: "Facility financing", contractId: "ctr_1", contractStatus: "OFFER_SENT" })
    );
    expect(action.label).toBe("Review Facility Offer");
  });

  it("uses invoice wording on a facility application once the facility offer is done", () => {
    const action = getApplicationCardPrimaryAction(
      makeApp({
        type: "Facility financing",
        contractId: "ctr_1",
        contractStatus: "APPROVED",
        invoices: [
          makeInvoice({
            contractId: "ctr_1",
            status: "OFFER_SENT",
            offerStatus: "Offer received",
            canReviewOffer: true,
            offeredAmount: 18,
          }),
        ],
      })
    );
    expect(action.label).toBe("Review Invoice Offer");
    expect(action.offerScope).toBe("invoice");
  });

  it("sends amendments to the edit flow", () => {
    const action = getApplicationCardPrimaryAction(
      makeApp({
        status: "AMENDMENT_REQUESTED",
        cardStatus: {
          badgeKey: "amendment_requested",
          displayLabel: "Action Required",
          showReviewOffer: false,
          showMakeAmendments: true,
        },
      })
    );
    expect(action.kind).toBe("makeAmendments");
    expect(action.href).toBe("/applications/app_1/edit");
  });
});

describe("applicationAttentionHeadline", () => {
  const base: Omit<ApplicationCardPrimaryAction, "kind" | "label" | "buttonVariant"> = {
    href: "/applications/app_1",
    hint: null,
    deadlineSummary: null,
  };

  it("names the task instead of repeating the badge", () => {
    expect(
      applicationAttentionHeadline({
        ...base,
        kind: "reviewOffer",
        label: "Review Invoice Offer",
        buttonVariant: "default",
        offerScope: "invoice",
      })
    ).toBe("Review this offer");
    expect(
      applicationAttentionHeadline({
        ...base,
        kind: "reviewOffer",
        label: "Review Facility Offer",
        buttonVariant: "default",
        offerScope: "contract",
      })
    ).toBe("Review this offer");
    expect(
      applicationAttentionHeadline({
        ...base,
        kind: "reviewOffer",
        label: "Update acceptance documents",
        buttonVariant: "outline",
        offerScope: "invoice",
      })
    ).toBe("Update your documents");
    expect(
      applicationAttentionHeadline({
        ...base,
        kind: "makeAmendments",
        label: "Make amendments",
        buttonVariant: "default",
      })
    ).toBe("Make the requested changes");
  });
});
