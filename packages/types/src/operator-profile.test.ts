import { buildOperatorProfileCompleteness, type OperatorProfileDto } from "./operator-profile";

function emptyProfile(overrides: Partial<OperatorProfileDto> = {}): OperatorProfileDto {
  return {
    id: "op_1",
    singletonKey: "cashsouk",
    name: null,
    registrationNumber: null,
    trusteeRegistrationNumber: null,
    scCompanyType: null,
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
  it("does not count Trustee Company Registration Number toward completeness", () => {
    const result = buildOperatorProfileCompleteness(
      emptyProfile({
        name: "CashSouk Sdn Bhd",
        registrationNumber: "1234567A",
        scCompanyType: "PRIVATE_LIMITED",
        responsiblePersonName: "Aisha Tan",
        responsiblePersonPhone: "+60123456789",
        trusteeRegistrationNumber: null,
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
    expect(result.missing.map((item) => item.field)).not.toContain("trusteeRegistrationNumber");
    expect(result.complete).toBe(true);
  });

  it("counts Total Limited Liability Partnership for LLP and not Sdn Bhd totals", () => {
    const llp = buildOperatorProfileCompleteness(
      emptyProfile({
        scCompanyType: "LLP",
        shareCapital: {
          id: "cap_1",
          ordinaryUnits: null,
          ordinaryAmount: null,
          preferenceUnits: null,
          preferenceAmount: null,
          othersUnits: null,
          othersAmount: null,
          totalPaidUpCapital: null,
          llpMembersCapitalUnits: "50",
          llpMembersCapitalAmount: "50",
          llpMembersReservesUnits: null,
          llpMembersReservesAmount: null,
          llpSubordinatedLoansUnits: null,
          llpSubordinatedLoansAmount: null,
          totalLlp: null,
        },
      })
    );
    expect(llp.missing.map((item) => item.field)).toContain("totalLlp");
    expect(llp.missing.map((item) => item.field)).not.toContain("totalPaidUpCapital");

    const sdn = buildOperatorProfileCompleteness(
      emptyProfile({
        scCompanyType: "PRIVATE_LIMITED",
        shareCapital: {
          id: "cap_1",
          ordinaryUnits: null,
          ordinaryAmount: null,
          preferenceUnits: null,
          preferenceAmount: null,
          othersUnits: null,
          othersAmount: null,
          totalPaidUpCapital: null,
          llpMembersCapitalUnits: null,
          llpMembersCapitalAmount: null,
          llpMembersReservesUnits: null,
          llpMembersReservesAmount: null,
          llpSubordinatedLoansUnits: null,
          llpSubordinatedLoansAmount: null,
          totalLlp: null,
        },
      })
    );
    expect(sdn.missing.map((item) => item.field)).toContain("totalPaidUpCapital");
    expect(sdn.missing.map((item) => item.field)).not.toContain("totalLlp");
  });

  it("does not count Sdn Bhd or LLP share-capital totals when Type of Company is not set", () => {
    const result = buildOperatorProfileCompleteness(emptyProfile());
    expect(result.missing.map((item) => item.field)).toContain("scCompanyType");
    expect(result.missing.map((item) => item.field)).not.toContain("totalPaidUpCapital");
    expect(result.missing.map((item) => item.field)).not.toContain("totalLlp");
    expect(result.sections.find((s) => s.id === "shareCapital")?.complete).toBe(false);
  });

  it("does not map Public Limited to either share-capital block", () => {
    const result = buildOperatorProfileCompleteness(
      emptyProfile({
        scCompanyType: "PUBLIC_LIMITED",
      })
    );
    expect(result.missing.map((item) => item.field)).not.toContain("totalPaidUpCapital");
    expect(result.missing.map((item) => item.field)).not.toContain("totalLlp");
    expect(result.sections.find((s) => s.id === "shareCapital")?.complete).toBe(false);
  });

  it("treats empty adviser and interest lists as complete", () => {
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
        scCompanyType: "PRIVATE_LIMITED",
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

  it("does not treat a name-only shareholder as complete", () => {
    const result = buildOperatorProfileCompleteness(
      emptyProfile({
        name: "CashSouk Sdn Bhd",
        registrationNumber: "1234567-A",
        scCompanyType: "PRIVATE_LIMITED",
        responsiblePersonName: "Aisha Tan",
        responsiblePersonPhone: "+60123456789",
        shareCapital: {
          id: "cap_1",
          ordinaryUnits: null,
          ordinaryAmount: null,
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
            identityNumber: null,
            dateOfBirth: null,
            dateOfIncorporation: null,
            nationality: null,
            address: null,
            dateAcquired: null,
            dateDisposal: null,
            shareType: null,
            shareTypeOther: null,
            shareholdingUnits: null,
            shareholdingAmount: null,
            shareholdingPercentage: null,
          },
        ],
      })
    );
    expect(result.sections.find((s) => s.id === "shareholders")?.complete).toBe(false);
    expect(result.missing.map((item) => item.field)).toContain("shareholders.sh_1.identityNumber");
  });

  it("does not treat a mostly blank financial year as complete", () => {
    const result = buildOperatorProfileCompleteness(
      emptyProfile({
        financialStatements: [
          {
            id: "fs_1",
            consolidatedAccounts: null,
            auditorName: null,
            financialYearEnd: "2025-12-31",
            unmodifiedReports: null,
            dateTabledToBoard: null,
            currency: null,
            numberOfShares: null,
            totalAssets: null,
            nonCurrentAssets: null,
            currentAssets: null,
            totalEquity: null,
            paidUpCapital: null,
            shareApplicationAccount: null,
            sharePremiumAndReserves: null,
            accumulatedProfitCarriedForward: null,
            equityMinorityInterest: null,
            totalLiabilities: null,
            nonCurrentLiabilities: null,
            currentLiabilities: null,
            totalRevenue: null,
            revenueDonation: null,
            revenueReward: null,
            revenueLending: null,
            revenueEquity: null,
            revenueFees: null,
            revenueOther: null,
            incomeDepositInterest: null,
            incomeOther: null,
            totalCost: null,
            costStaff: null,
            costSystem: null,
            costPromotion: null,
            costOther: null,
            profitBeforeTax: null,
            taxation: null,
            profitAfterTax: null,
            pnlMinorityInterest: null,
            netDividend: null,
          },
        ],
      })
    );
    expect(result.sections.find((s) => s.id === "financials")?.complete).toBe(false);
    expect(result.missing.map((item) => item.field)).toContain("financialStatements.fs_1.totalAssets");
  });

  it("does not require salutation, resignation, or unused P&L components for profile completeness", () => {
    const result = buildOperatorProfileCompleteness(
      emptyProfile({
        name: "CashSouk Sdn Bhd",
        registrationNumber: "1234567-A",
        scCompanyType: "PRIVATE_LIMITED",
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
    expect(result.missing.map((item) => item.field).some((field) => field.includes("salutation"))).toBe(
      false
    );
    expect(result.missing.map((item) => item.field).some((field) => field.includes("resignation"))).toBe(
      false
    );
    expect(result.complete).toBe(true);
  });
});
