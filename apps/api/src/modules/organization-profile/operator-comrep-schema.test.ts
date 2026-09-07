import {
  operatorAdvisorSchema,
  operatorFinancialStatementSchema,
  operatorInterestSchema,
  operatorOfficerSchema,
  operatorShareCapitalPatchSchema,
  operatorShareholderSchema,
  orgMasterPatchSchema,
  parseOperatorBody,
} from "./schemas";

const completeShareholder = {
  holderType: "SHAREHOLDER" as const,
  entityType: "INDIVIDUAL" as const,
  name: "Aisha",
  salutation: "Ms",
  identityNumber: "800101011234",
  dateOfBirth: "1980-01-01",
  nationality: "MALAYSIA",
  address: "1 Jalan A",
  dateAcquired: "2020-01-01",
  shareType: "ORDINARY" as const,
  shareholdingUnits: "100",
  shareholdingAmount: "100",
  shareholdingPercentage: "100",
};

const completeOfficer = {
  personKind: "BOARD" as const,
  name: "Aisha",
  isResponsiblePerson: true,
  identityNumber: "800101011234",
  dateOfBirth: "1980-01-01",
  nationality: "MALAYSIA",
  address: "1 Jalan A",
  designation: "CHIEF_EXECUTIVE_OFFICER" as const,
  appointmentDate: "2020-01-01",
};

const completeAdvisor = {
  advisorType: "AUDITOR" as const,
  name: "Audit Co",
  registrationNumber: "1234567A",
  country: "MALAYSIA",
  address: "1 Jalan A",
  appointmentDate: "2020-01-01",
};

const completeInterest = {
  name: "HoldCo",
  registrationNumber: "1234567A",
  country: "MALAYSIA",
  address: "1 Jalan A",
  acquisitionDate: "2020-01-01",
  shareType: "ORDINARY" as const,
  shareholdingUnits: "10",
  shareholdingPercentage: "10",
};

const completeFinancial = {
  consolidatedAccounts: true,
  auditorName: "Audit Co",
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
  totalRevenue: "1000",
  revenueDonation: "0",
  revenueReward: "0",
  revenueLending: "800",
  revenueEquity: "0",
  revenueFees: "200",
  revenueOther: "0",
  incomeDepositInterest: "0",
  incomeOther: "0",
  totalCost: "400",
  costStaff: "250",
  costSystem: "150",
  costPromotion: "0",
  costOther: "0",
  profitBeforeTax: "600",
  taxation: "0",
  profitAfterTax: "600",
  pnlMinorityInterest: "0",
  netDividend: "0",
};

describe("operator ComRep schemas", () => {
  it("rejects Type of Shares Others without specify text", () => {
    const result = operatorShareholderSchema.safeParse({
      ...completeShareholder,
      shareType: "OTHERS",
      shareTypeOther: "",
    });
    expect(result.success).toBe(false);
  });

  it("clears Type of Shares other text when the type is not Others", () => {
    const parsed = operatorShareholderSchema.parse({
      ...completeShareholder,
      shareType: "ORDINARY",
      shareTypeOther: "leftover",
    });
    expect(parsed.shareTypeOther).toBeNull();
  });

  it("rejects Beneficial Owner as a corporate entity", () => {
    const result = operatorShareholderSchema.safeParse({
      ...completeShareholder,
      holderType: "BENEFICIAL_OWNER",
      entityType: "CORPORATE",
    });
    expect(result.success).toBe(false);
  });

  it("accepts Shareholder, Member, and Beneficial Owner combinations", () => {
    expect(operatorShareholderSchema.safeParse({ ...completeShareholder, holderType: "MEMBER" }).success).toBe(
      true
    );
    expect(
      operatorShareholderSchema.safeParse({
        ...completeShareholder,
        holderType: "SHAREHOLDER",
        entityType: "CORPORATE",
        name: "HoldCo Sdn Bhd",
        salutation: null,
        identityNumber: "1234567A",
        dateOfBirth: null,
        dateOfIncorporation: "2010-01-01",
      }).success
    ).toBe(true);
    expect(
      operatorShareholderSchema.safeParse({
        ...completeShareholder,
        holderType: "BENEFICIAL_OWNER",
        entityType: "INDIVIDUAL",
        name: "Ali",
      }).success
    ).toBe(true);
  });

  it("rejects a name-only shareholder", () => {
    expect(
      operatorShareholderSchema.safeParse({
        holderType: "SHAREHOLDER",
        entityType: "INDIVIDUAL",
        name: "Aisha",
      }).success
    ).toBe(false);
  });

  it("stores Total Revenue and Total Cost as explicit fields", () => {
    const parsed = operatorFinancialStatementSchema.parse(completeFinancial);
    expect(parsed.totalRevenue).toBe("1000");
    expect(parsed.totalCost).toBe("400");
  });

  it("rejects a partial financial statement", () => {
    expect(
      operatorFinancialStatementSchema.safeParse({
        totalRevenue: "1000",
        revenueLending: "800",
        revenueFees: "200",
        totalCost: "400",
        costStaff: "250",
        costSystem: "150",
      }).success
    ).toBe(false);
  });

  it("rejects share-capital payloads that still contain id", () => {
    const result = operatorShareCapitalPatchSchema.safeParse({
      id: "cap_1",
      ordinaryUnits: "50",
    });
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error.issues[0]?.message).toMatch(/Unrecognized key/i);
  });

  it("strips DTO id then accepts a share-capital save", () => {
    const parsed = parseOperatorBody(operatorShareCapitalPatchSchema, {
      id: "cap_1",
      ordinaryUnits: "50",
      ordinaryAmount: "50",
      totalPaidUpCapital: "50",
    });
    expect(parsed.ordinaryUnits).toBe("50");
    expect(parsed.totalPaidUpCapital).toBe("50");
  });

  it("rejects explicit clear of a required share-capital field", () => {
    expect(operatorShareCapitalPatchSchema.safeParse({ ordinaryUnits: null }).success).toBe(false);
  });

  it("rejects share counts with decimal points", () => {
    const result = operatorShareCapitalPatchSchema.safeParse({
      ordinaryUnits: "50.5",
    });
    expect(result.success).toBe(false);
  });

  it("strips id from shareholder update bodies without loosening unknown keys", () => {
    const parsed = parseOperatorBody(operatorShareholderSchema, {
      id: "sh_1",
      ...completeShareholder,
    });
    expect(parsed.name).toBe("Aisha");
    const extra = operatorShareholderSchema.safeParse({
      ...completeShareholder,
      unknownField: true,
    });
    expect(extra.success).toBe(false);
  });

  it("strips DTO id from officer, adviser, interest, and financial statement bodies", () => {
    expect(parseOperatorBody(operatorOfficerSchema, { id: "of_1", ...completeOfficer }).name).toBe("Aisha");
    expect(parseOperatorBody(operatorAdvisorSchema, { id: "ad_1", ...completeAdvisor }).name).toBe("Audit Co");
    expect(parseOperatorBody(operatorInterestSchema, { id: "in_1", ...completeInterest }).name).toBe("HoldCo");
    expect(
      parseOperatorBody(operatorFinancialStatementSchema, { id: "fs_1", ...completeFinancial }).totalRevenue
    ).toBe("1000");
  });

  it("still rejects unknown keys on officer, adviser, interest, and financial bodies", () => {
    expect(operatorOfficerSchema.safeParse({ ...completeOfficer, extra: true }).success).toBe(false);
    expect(operatorAdvisorSchema.safeParse({ ...completeAdvisor, extra: true }).success).toBe(false);
    expect(operatorInterestSchema.safeParse({ ...completeInterest, extra: true }).success).toBe(false);
    expect(operatorFinancialStatementSchema.safeParse({ ...completeFinancial, extra: true }).success).toBe(
      false
    );
  });
});

describe("issuer master profile patch", () => {
  it("rejects blank and invalid E-mail Address and accepts a valid address", () => {
    expect(orgMasterPatchSchema.safeParse({ companyEmail: "" }).success).toBe(false);
    expect(orgMasterPatchSchema.safeParse({ companyEmail: "   " }).success).toBe(false);
    expect(orgMasterPatchSchema.safeParse({ companyEmail: "not-an-email" }).success).toBe(false);
    expect(orgMasterPatchSchema.safeParse({ companyEmail: null }).success).toBe(false);
    expect(orgMasterPatchSchema.safeParse({ companyEmail: "ops@acme.test" }).success).toBe(true);
  });

  it("allows an unrelated patch to omit E-mail Address", () => {
    expect(orgMasterPatchSchema.safeParse({ phoneNumber: "+60123456789" }).success).toBe(true);
  });
});
