import type { NormalizedApplication } from "../status";
import {
  applicationAttentionHeadline,
  applicationCardSubStatus,
  applicationHeadlineAmount,
  getApplicationCardPrimaryAction,
  type ApplicationCardPrimaryAction,
} from "./application-card-model";

jest.mock("@cashsouk/config", () => ({
  formatCurrency: (value: number) => `RM ${value}`,
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

describe("applicationHeadlineAmount", () => {
  it("prefers facility applied, then contract value, then invoice sum", () => {
    expect(applicationHeadlineAmount(makeApp({ facilityApplied: 10 }))).toBe("RM 10");
    expect(
      applicationHeadlineAmount(makeApp({ facilityApplied: null, contractValue: 20 }))
    ).toBe("RM 20");
    expect(
      applicationHeadlineAmount(
        makeApp({
          facilityApplied: null,
          contractValue: null,
          invoices: [
            {
              id: "inv_1",
              number: "INV-1",
              contractId: null,
              maturityDate: null,
              value: 30,
              appliedFinancing: 25,
              document: "invoice.pdf",
              documentS3Key: null,
              financingOffered: "—",
              platformFee: "—",
              profitRate: "—",
              status: "OFFER_SENT",
              offerStatus: "Offer received",
              canReviewOffer: true,
              signedOfferLetterAvailable: false,
              signedOfferLetterS3Key: null,
              reasonOrRemarks: null,
            },
          ],
        })
      )
    ).toBe("RM 25");
  });
});

describe("applicationCardSubStatus", () => {
  it("counts invoices that need amendment or were rejected", () => {
    expect(
      applicationCardSubStatus(
        makeApp({
          invoices: [
            {
              id: "inv_1",
              number: "INV-1",
              contractId: null,
              maturityDate: null,
              value: 30,
              appliedFinancing: 25,
              document: "invoice.pdf",
              documentS3Key: null,
              financingOffered: "—",
              platformFee: "—",
              profitRate: "—",
              status: "AMENDMENT_REQUESTED",
              offerStatus: null,
              canReviewOffer: false,
              signedOfferLetterAvailable: false,
              signedOfferLetterS3Key: null,
              reasonOrRemarks: null,
            },
          ],
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
          {
            id: "inv_1",
            number: "INV-1",
            contractId: "ctr_1",
            maturityDate: null,
            value: 30,
            appliedFinancing: 25,
            document: "invoice.pdf",
            documentS3Key: null,
            financingOffered: "—",
            platformFee: "—",
            profitRate: "—",
            status: "OFFER_SENT",
            offerStatus: "Offer received",
            canReviewOffer: true,
            signedOfferLetterAvailable: false,
            signedOfferLetterS3Key: null,
            reasonOrRemarks: null,
          },
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
