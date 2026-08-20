import type { IssuerDashboardContract } from "@/types/issuer-dashboard";
import {
  facilityAttentionDetail,
  facilityAttentionMeta,
  getFacilityAttentionAction,
} from "./facility-attention-card-model";

function contract(overrides: Partial<IssuerDashboardContract> = {}): IssuerDashboardContract {
  return {
    id: "con_1",
    displayReference: "CON-ARF-1",
    applicationId: "app_1",
    productId: "prod_1",
    contractForModal: {
      status: "OFFER_SENT",
      offer_details: { offered_facility: 500000 },
      contract_details: { number: "FAC-100" },
    },
    title: "Acme supply agreement",
    productName: "Facility financing",
    customerName: "Acme Trading",
    contractStartDate: "2026-01-01",
    contractEndDate: "2026-12-31",
    approvedFacilityAmount: "500000",
    utilizedFacilityAmount: "100000",
    availableFacilityAmount: "400000",
    facilityFeeCapAmount: null,
    facilityFeePaidAmount: null,
    facilityFeeRemainingAmount: null,
    activeNotesCount: 0,
    contractStatus: "OFFER_SENT",
    actionRequiredApplicationIds: [],
    invoiceStats: {
      total: 2,
      approved: 1,
      rejected: 0,
      unfinanced: 1,
      fundingInProgress: 0,
      activeNotes: 0,
      completedNotes: 0,
      unsuccessfulRaise: 0,
      disputedNotes: null,
    },
    ...overrides,
  };
}

describe("getFacilityAttentionAction", () => {
  it("sends facility offer review to the application offer tab", () => {
    const action = getFacilityAttentionAction(contract());
    expect(action.headline).toBe("Review this offer");
    expect(action.href).toBe("/applications/app_1?tab=offer");
    expect(action.label).toBe("Review offer");
    expect(action.hint).toBe("You'll review this on your application.");
  });

  it("sends facility-level amendments to the application editor", () => {
    const action = getFacilityAttentionAction(
      contract({
        contractStatus: "AMENDMENT_REQUESTED",
        contractForModal: { status: "AMENDMENT_REQUESTED" },
        actionRequiredApplicationIds: ["app_1"],
      })
    );
    expect(action.headline).toBe("Make the requested changes");
    expect(action.href).toBe("/applications/app_1/edit");
    expect(action.label).toBe("Make amendments");
  });

  it("does not treat an approved facility as an amendment task when only a tied invoice needs changes", () => {
    const action = getFacilityAttentionAction(
      contract({
        contractStatus: "APPROVED",
        contractForModal: { status: "APPROVED" },
        actionRequiredApplicationIds: ["app_1"],
      })
    );
    expect(action.headline).toBe("This needs your response");
    expect(action.href).toBe("/financing/contracts/con_1");
    expect(action.label).toBe("View details");
  });
});

describe("facility attention copy", () => {
  it("joins reference and title, and names utilisation plus invoice count", () => {
    expect(facilityAttentionMeta(contract())).toContain("CON-ARF-1");
    expect(facilityAttentionDetail(contract())).toBe("20% used · 2 invoices");
    expect(
      facilityAttentionDetail(
        contract({
          approvedFacilityAmount: null,
          utilizedFacilityAmount: null,
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
        })
      )
    ).toBeNull();
  });
});
