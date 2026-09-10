import {
  buildOperatorProfileCompleteness,
  isOperatorSigningRole,
  legacyAuthorisedSignatoryNameFromSigningPeople,
  OPERATOR_SIGNING_ROLE_LABELS,
  OPERATOR_SIGNING_ROLES,
  signingRolesImpliedByOfficer,
  type OperatorProfileDto,
} from "./operator-profile";

function completeShareholder(
  overrides: Partial<OperatorProfileDto["shareholders"][number]> = {}
): OperatorProfileDto["shareholders"][number] {
  return {
    id: "sh_1",
    holderType: "SHAREHOLDER",
    entityType: "INDIVIDUAL",
    name: "Aisha Tan",
    salutation: "Ms",
    identityNumber: "800101011234",
    dateOfBirth: "1980-01-01",
    dateOfIncorporation: null,
    nationality: "MALAYSIA",
    address: "1 Jalan Ampang",
    dateAcquired: "2020-01-01",
    dateDisposal: null,
    shareType: "ORDINARY",
    shareTypeOther: null,
    shareholdingUnits: "1000",
    shareholdingAmount: "1000",
    shareholdingPercentage: "100",
    ...overrides,
  };
}

function completeOfficer(
  overrides: Partial<OperatorProfileDto["officers"][number]> = {}
): OperatorProfileDto["officers"][number] {
  return {
    id: "of_1",
    personKind: "BOARD",
    name: "Aisha Tan",
    salutation: null,
    isResponsiblePerson: true,
    identityNumber: "800101011234",
    dateOfBirth: "1980-01-01",
    nationality: "MALAYSIA",
    address: "1 Jalan Ampang",
    designation: "CHIEF_EXECUTIVE_OFFICER",
    designationOther: null,
    appointmentDate: "2020-01-01",
    resignationDate: null,
    ...overrides,
  };
}

function completeSdnCapital(
  overrides: Partial<NonNullable<OperatorProfileDto["shareCapital"]>> = {}
): NonNullable<OperatorProfileDto["shareCapital"]> {
  return {
    id: "cap_1",
    ordinaryUnits: "1000",
    ordinaryAmount: "1000",
    preferenceUnits: "0",
    preferenceAmount: "0",
    othersUnits: "0",
    othersAmount: "0",
    totalPaidUpCapital: "1000",
    llpMembersCapitalUnits: null,
    llpMembersCapitalAmount: null,
    llpMembersReservesUnits: null,
    llpMembersReservesAmount: null,
    llpSubordinatedLoansUnits: null,
    llpSubordinatedLoansAmount: null,
    totalLlp: null,
    ...overrides,
  };
}

function completeFinancial(
  overrides: Partial<OperatorProfileDto["financialStatements"][number]> = {}
): OperatorProfileDto["financialStatements"][number] {
  return {
    id: "fs_1",
    consolidatedAccounts: true,
    auditorName: "Auditor",
    financialYearEnd: "2025-12-31",
    unmodifiedReports: true,
    dateTabledToBoard: "2026-01-15",
    currency: "MYR",
    numberOfShares: "1000",
    totalAssets: "1",
    nonCurrentAssets: "0",
    currentAssets: "1",
    totalEquity: "1",
    paidUpCapital: "1",
    shareApplicationAccount: "0",
    sharePremiumAndReserves: "0",
    accumulatedProfitCarriedForward: "0",
    equityMinorityInterest: "0",
    totalLiabilities: "0",
    nonCurrentLiabilities: "0",
    currentLiabilities: "0",
    totalRevenue: "1",
    revenueDonation: "0",
    revenueReward: "0",
    revenueLending: "1",
    revenueEquity: "0",
    revenueFees: "0",
    revenueOther: "0",
    incomeDepositInterest: "0",
    incomeOther: "0",
    totalCost: "0",
    costStaff: "0",
    costSystem: "0",
    costPromotion: "0",
    costOther: "0",
    profitBeforeTax: "1",
    taxation: "0",
    profitAfterTax: "1",
    pnlMinorityInterest: "0",
    netDividend: "0",
    ...overrides,
  };
}

function completeOperator(overrides: Partial<OperatorProfileDto> = {}): OperatorProfileDto {
  return emptyProfile({
    name: "CashSouk Sdn Bhd",
    registrationNumber: "1234567A",
    scCompanyType: "PRIVATE_LIMITED",
    responsiblePersonName: "Aisha Tan",
    responsiblePersonPhone: "+60123456789",
    shareCapital: completeSdnCapital(),
    shareholders: [completeShareholder()],
    officers: [completeOfficer()],
    financialStatements: [completeFinancial()],
    ...overrides,
  });
}

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
    signingPeople: [],
    companyStamp: null,
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
    expect(result.complete).toBe(false);
    expect(result.missing.map((item) => item.field)).toEqual(
      expect.arrayContaining([
        "preferenceUnits",
        "shareholders.sh_1.salutation",
        "shareholders.sh_1.dateOfBirth",
        "officers.of_1.dateOfBirth",
      ])
    );
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
    const result = buildOperatorProfileCompleteness(completeOperator());
    expect(result.complete).toBe(true);
    expect(result.percent).toBe(100);
    expect(result.missing.map((item) => item.field)).not.toContain("trusteeRegistrationNumber");
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

  it("does not require officer salutation or resignation, and does not require a disposal date", () => {
    const result = buildOperatorProfileCompleteness(
      completeOperator({
        shareholders: [completeShareholder({ dateDisposal: null })],
        officers: [completeOfficer({ salutation: null, resignationDate: null })],
      })
    );
    expect(result.missing.map((item) => item.field).some((field) => field.includes("salutation"))).toBe(
      false
    );
    expect(result.missing.map((item) => item.field).some((field) => field.includes("resignation"))).toBe(
      false
    );
    expect(result.missing.map((item) => item.field).some((field) => field.includes("dateDisposal"))).toBe(
      false
    );
    expect(result.complete).toBe(true);
  });

  it("uses annual [03000] Date Acquired rather than monthly issuer [05000] Identity Prefix", () => {
    const missingAcquired = buildOperatorProfileCompleteness(
      completeOperator({
        shareholders: [completeShareholder({ dateAcquired: null })],
      })
    );
    expect(missingAcquired.missing.some((item) => item.field.includes("dateAcquired"))).toBe(true);
    expect(missingAcquired.missing.some((item) => item.field.includes("identityPrefix"))).toBe(false);
  });

  it("uses annual [04000] Board of Director/Management Team rather than issuer share type", () => {
    const missingKind = buildOperatorProfileCompleteness(
      completeOperator({
        officers: [completeOfficer({ personKind: "" as never })],
      })
    );
    expect(missingKind.missing.some((item) => item.field.includes("personKind"))).toBe(true);
    expect(missingKind.missing.some((item) => item.field.includes("shareType"))).toBe(false);
  });

  it("requires individual shareholder salutation and annual financial line items", () => {
    const missingSalutation = buildOperatorProfileCompleteness(
      completeOperator({
        shareholders: [completeShareholder({ salutation: null })],
      })
    );
    expect(missingSalutation.missing.map((item) => item.field)).toContain("shareholders.sh_1.salutation");

    const missingPnl = buildOperatorProfileCompleteness(
      completeOperator({
        financialStatements: [completeFinancial({ revenueDonation: null })],
      })
    );
    expect(missingPnl.missing.map((item) => item.field)).toContain(
      "financialStatements.fs_1.revenueDonation"
    );
  });

  it("does not treat Signing & Authorisation as a profile completeness section", () => {
    const complete = buildOperatorProfileCompleteness(completeOperator());
    const withSigning = buildOperatorProfileCompleteness(
      completeOperator({
        signingPeople: [
          {
            id: "sp_1",
            officerId: "of_1",
            personName: "Aisha Tan",
            personKind: "BOARD",
            designation: "DIRECTOR_EXECUTIVE",
            designationOther: null,
            roles: ["AUTHORISED_SIGNATORY", "WITNESS"],
            signature: { s3Key: "sig/a.png" },
            active: true,
          },
        ],
        companyStamp: { s3Key: "stamps/a.png", fileName: "stamp.png", contentType: "image/png" },
      })
    );
    expect(complete.percent).toBe(withSigning.percent);
    expect(withSigning.missing.some((item) => item.field.includes("signing"))).toBe(false);
    expect(withSigning.sections.map((section) => section.id)).not.toContain("signing");
  });
});

describe("Shoraka signing execution roles", () => {
  it("exposes Authorised Signatory and Witness only", () => {
    expect(OPERATOR_SIGNING_ROLES).toEqual(["AUTHORISED_SIGNATORY", "WITNESS"]);
    expect(OPERATOR_SIGNING_ROLE_LABELS.AUTHORISED_SIGNATORY).toBe("Authorised Signatory");
    expect(OPERATOR_SIGNING_ROLE_LABELS.WITNESS).toBe("Witness");
    expect(isOperatorSigningRole("AUTHORISED_SIGNATORY")).toBe(true);
    expect(isOperatorSigningRole("WITNESS")).toBe(true);
  });

  it("does not map Board, Management, or Director designations to signing roles", () => {
    expect(isOperatorSigningRole("BOARD")).toBe(false);
    expect(isOperatorSigningRole("MANAGEMENT")).toBe(false);
    expect(isOperatorSigningRole("DIRECTOR")).toBe(false);
    expect(isOperatorSigningRole("DIRECTOR_EXECUTIVE")).toBe(false);
    expect(
      signingRolesImpliedByOfficer({ personKind: "BOARD", designation: "DIRECTOR_EXECUTIVE" })
    ).toEqual([]);
    expect(signingRolesImpliedByOfficer({ personKind: "MANAGEMENT", designation: "SECRETARY" })).toEqual(
      []
    );
  });

  it("can store multiple execution roles on one person", () => {
    const name = legacyAuthorisedSignatoryNameFromSigningPeople([
      {
        active: true,
        roles: ["WITNESS"],
        personName: "Sarah",
      },
      {
        active: true,
        roles: ["AUTHORISED_SIGNATORY", "WITNESS"],
        personName: "Ahmad Lee",
      },
    ]);
    expect(name).toBe("Ahmad Lee");
  });

  it("does not blank the legacy name when no active Authorised Signatory exists", () => {
    expect(
      legacyAuthorisedSignatoryNameFromSigningPeople([
        {
          active: false,
          roles: ["AUTHORISED_SIGNATORY"],
          personName: "Ahmad Lee",
        },
        {
          active: true,
          roles: ["WITNESS"],
          personName: "Sarah Tan",
        },
      ])
    ).toBeNull();
  });
});
