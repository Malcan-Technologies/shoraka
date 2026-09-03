import { buildOperatorProfileCompleteness, type OperatorProfileDto } from "./operator-profile";

function emptyProfile(overrides: Partial<OperatorProfileDto> = {}): OperatorProfileDto {
  return {
    id: "op_1",
    singletonKey: "cashsouk",
    name: null,
    registrationNumber: null,
    trusteeRegistrationNumber: null,
    responsiblePersonName: null,
    responsiblePersonPhone: null,
    shareCapital: null,
    shareholders: [],
    officers: [],
    advisors: [],
    interests: [],
    financialStatements: [],
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("operator profile completeness", () => {
  it("treats advisers and interests as optional", () => {
    const result = buildOperatorProfileCompleteness(emptyProfile());
    expect(result.sections.find((s) => s.id === "advisors")?.complete).toBe(true);
    expect(result.sections.find((s) => s.id === "interests")?.complete).toBe(true);
    expect(result.complete).toBe(false);
  });

  it("is complete when required master sections are filled", () => {
    const result = buildOperatorProfileCompleteness(
      emptyProfile({
        name: "CashSouk Sdn Bhd",
        registrationNumber: "1234567-A",
        responsiblePersonName: "Aisha Tan",
        responsiblePersonPhone: "+60123456789",
        shareCapital: {
          id: "cap_1",
          ordinaryUnits: "1000",
          ordinaryAmount: "1000",
          preferenceUnits: null,
          preferenceAmount: null,
          othersUnits: null,
          othersAmount: null,
          totalPaidUpCapital: "1000",
          llpMembersCapitalUnits: null,
          llpMembersCapitalAmount: null,
          llpMembersReservesUnits: null,
          llpMembersReservesAmount: null,
          llpSubordinatedLoansUnits: null,
          llpSubordinatedLoansAmount: null,
          totalLlp: null,
        },
        shareholders: [
          {
            id: "sh_1",
            holderType: "SHAREHOLDER",
            entityType: "INDIVIDUAL",
            name: "Aisha Tan",
            salutation: null,
            identityNumber: "800101011234",
            dateOfBirth: null,
            dateOfIncorporation: null,
            nationality: null,
            address: null,
            dateAcquired: null,
            dateDisposal: null,
            shareType: "ORDINARY",
            shareTypeOther: null,
            shareholdingUnits: "1000",
            shareholdingAmount: "1000",
            shareholdingPercentage: "100",
          },
        ],
        officers: [
          {
            id: "of_1",
            personKind: "BOARD",
            name: "Aisha Tan",
            salutation: null,
            isResponsiblePerson: true,
            identityNumber: "800101011234",
            dateOfBirth: null,
            nationality: null,
            address: null,
            designation: "CHIEF_EXECUTIVE_OFFICER",
            designationOther: null,
            appointmentDate: null,
            resignationDate: null,
          },
        ],
        financialStatements: [
          {
            id: "fs_1",
            consolidatedAccounts: true,
            auditorName: "Auditor",
            financialYearEnd: "2025-12-31",
            unmodifiedReports: true,
            dateTabledToBoard: null,
            currency: "MYR",
            numberOfShares: "1000",
            totalAssets: "1",
            nonCurrentAssets: null,
            currentAssets: null,
            totalEquity: "1",
            paidUpCapital: null,
            shareApplicationAccount: null,
            sharePremiumAndReserves: null,
            accumulatedProfitCarriedForward: null,
            equityMinorityInterest: null,
            totalLiabilities: "0",
            nonCurrentLiabilities: null,
            currentLiabilities: null,
            totalRevenue: "1",
            revenueDonation: null,
            revenueReward: null,
            revenueLending: null,
            revenueEquity: null,
            revenueFees: null,
            revenueOther: null,
            incomeDepositInterest: null,
            incomeOther: null,
            totalCost: "0",
            costStaff: null,
            costSystem: null,
            costPromotion: null,
            costOther: null,
            profitBeforeTax: "1",
            taxation: null,
            profitAfterTax: "1",
            pnlMinorityInterest: null,
            netDividend: null,
          },
        ],
      })
    );
    expect(result.complete).toBe(true);
    expect(result.percent).toBe(100);
  });
});
