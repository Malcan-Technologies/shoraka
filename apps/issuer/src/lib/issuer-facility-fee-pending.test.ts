jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import type { IssuerDashboardContract } from "@/types/issuer-dashboard";
import {
  facilityFeeBannerDescription,
  isIssuerContractFeeOnlyActionable,
  outstandingFacilityFeeAmount,
  remainingFacilityFeeForDrawdowns,
} from "./issuer-facility-fee-pending";

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

describe("issuer facility fee dashboard copy", () => {
  it("reads the outstanding amount and treats a fee-only approved facility as payable", () => {
    const row = contract({
      facilityFeeUpfrontAmount: 5000,
      facilityFeeUpfrontOutstanding: 2500,
    });
    expect(outstandingFacilityFeeAmount(row)).toBe(2500);
    expect(isIssuerContractFeeOnlyActionable(row)).toBe(true);
    expect(
      isIssuerContractFeeOnlyActionable(
        contract({
          contractStatus: "AMENDMENT_REQUESTED",
          contractForModal: { status: "AMENDMENT_REQUESTED" },
          facilityFeeUpfrontOutstanding: 2500,
        })
      )
    ).toBe(false);
  });

  it("treats remaining facility fee after the upfront as later drawdown collection", () => {
    expect(
      remainingFacilityFeeForDrawdowns(
        contract({
          facilityFeeUpfrontOutstanding: 2500,
          facilityFeeRemainingAmount: "3000",
        })
      )
    ).toBe(500);
    expect(
      remainingFacilityFeeForDrawdowns(
        contract({
          facilityFeeUpfrontOutstanding: 2500,
          facilityFeeCapAmount: "5000",
          facilityFeePaidAmount: "2500",
        })
      )
    ).toBe(0);
  });

  it("names the outstanding fee and later drawdown remainder without repeating the amount", () => {
    expect(
      facilityFeeBannerDescription({ outstanding: 2500, remainingForDrawdowns: 500 })
    ).toBe("RM 2,500.00 is due now. RM 500.00 will be collected from later drawdowns.");
    expect(
      facilityFeeBannerDescription({ outstanding: 2500, remainingForDrawdowns: 0 })
    ).toBe(
      "RM 2,500.00 is due now. No further facility fee will be collected from later drawdowns."
    );
    expect(facilityFeeBannerDescription({ outstanding: 0, remainingForDrawdowns: 500 })).toBeNull();
  });
});
