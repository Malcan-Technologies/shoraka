import type { IssuerDashboardContract } from "@/types/issuer-dashboard";
import { isIssuerContractActionable } from "./issuer-contract-actionable";

function contract(overrides: Partial<IssuerDashboardContract> = {}): IssuerDashboardContract {
  return {
    id: "con_1",
    displayReference: "CON-ARF-1",
    applicationId: "app_1",
    productId: "prod_1",
    contractForModal: { status: "APPROVED", contract_details: { number: "FAC-100" } },
    title: "Mining Rig Repair 1234",
    productName: "Facility financing",
    customerName: "Acme",
    contractStartDate: "2026-01-01",
    contractEndDate: "2026-12-31",
    approvedFacilityAmount: "100000",
    utilizedFacilityAmount: "0",
    availableFacilityAmount: "100000",
    facilityFeeCapAmount: null,
    facilityFeePaidAmount: null,
    facilityFeeRemainingAmount: null,
    activeNotesCount: 0,
    contractStatus: "APPROVED",
    actionRequiredApplicationIds: [],
    invoiceStats: {
      total: 1,
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

describe("isIssuerContractActionable", () => {
  it("keeps an approved facility in the list when only a tied invoice needs amendment", () => {
    expect(
      isIssuerContractActionable(
        contract({
          actionRequiredApplicationIds: ["app_1"],
        })
      )
    ).toBe(false);
  });

  it("treats a facility-level amendment as actionable", () => {
    expect(
      isIssuerContractActionable(
        contract({
          contractStatus: "AMENDMENT_REQUESTED",
          contractForModal: { status: "AMENDMENT_REQUESTED" },
          actionRequiredApplicationIds: ["app_1"],
        })
      )
    ).toBe(true);
  });

  it("treats a facility offer awaiting issuer review as actionable", () => {
    expect(
      isIssuerContractActionable(
        contract({
          contractStatus: "OFFER_SENT",
          contractForModal: {
            status: "OFFER_SENT",
            offer_details: { offered_facility: 100000 },
          },
        })
      )
    ).toBe(true);
  });
});
