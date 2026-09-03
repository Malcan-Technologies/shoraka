import {
  buildInvestorProfileCompleteness,
  buildIssuerProfileCompleteness,
  computeIssuerCompanyCompleteness,
  issuerFinancialsFromYearBlock,
  isMasterFieldEmpty,
  latestUnauditedYearKey,
  OPERATOR_HOLDER_TYPES,
  ORGANIZATION_PARTY_ENTITY_TYPES,
  valuesEqualForMismatch,
} from "./comrep-profile";

describe("issuer company completeness [02000]", () => {
  it("requires registered and business line1, state, and postcode", () => {
    const missing = computeIssuerCompanyCompleteness({
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: "org_1",
      companyCategory: "TECHNOLOGY",
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "Malaysia",
      scCompanyType: "PRIVATE_LIMITED",
      registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      businessAddress: { line1: "", state: "Selangor", postalCode: "40000" },
      phoneNumber: "+60123456789",
      companyEmail: "ops@acme.test",
      companyActivities: "Invoice financing",
    });
    expect(missing.map((m) => m.field)).toContain("businessAddress.line1");
  });

  it("does not require website, city, or TIN", () => {
    const missing = computeIssuerCompanyCompleteness({
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: "org_1",
      companyCategory: "NON_TECHNOLOGY",
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "Malaysia",
      scCompanyType: "PRIVATE_LIMITED",
      registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      businessAddress: { line1: "2 Jalan B", state: "Selangor", postalCode: "40000" },
      phoneNumber: "+60123456789",
      companyEmail: "ops@acme.test",
      companyActivities: "Construction",
    });
    expect(missing.map((m) => m.field)).not.toContain("website");
    expect(missing).toHaveLength(0);
  });
});

describe("issuer profile completeness", () => {
  it("is incomplete when CTOS produced no master shareholders", () => {
    const result = buildIssuerProfileCompleteness({
      company: {
        name: "Acme Sdn Bhd",
        registrationNumber: "1234567A",
        organizationId: "org_1",
        companyCategory: "TECHNOLOGY",
        dateOfIncorporation: "2020-01-01",
        dateOfCommencement: "2020-02-01",
        countryOfIncorporation: "Malaysia",
        scCompanyType: "PRIVATE_LIMITED",
        registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
        businessAddress: { line1: "2 Jalan B", state: "Selangor", postalCode: "40000" },
        phoneNumber: "+60123456789",
        companyEmail: "ops@acme.test",
        companyActivities: "Lending",
      },
      shareholders: [],
      board: [],
      financials: null,
    });
    expect(result.complete).toBe(false);
    expect(result.percent).toBeLessThan(100);
    expect(result.missing.some((m) => m.field === "shareholders")).toBe(true);
    expect(result.steps.find((s) => s.id === "board")?.complete).toBe(true);
  });

  it("treats mismatch as irrelevant — completeness uses master values only", () => {
    const result = buildIssuerProfileCompleteness({
      company: {
        name: "Master Name",
        registrationNumber: "1234567A",
        organizationId: "org_1",
        companyCategory: "TECHNOLOGY",
        dateOfIncorporation: "2020-01-01",
        dateOfCommencement: "2020-02-01",
        countryOfIncorporation: "Malaysia",
        scCompanyType: "PRIVATE_LIMITED",
        registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
        businessAddress: { line1: "2 Jalan B", state: "Selangor", postalCode: "40000" },
        phoneNumber: "+60123456789",
        companyEmail: "ops@acme.test",
        companyActivities: "Lending",
      },
      shareholders: [
        {
          partyKey: "800101011234",
          name: "Ali",
          entityType: "INDIVIDUAL",
          identityPrefix: "NRIC",
          identityNumber: "800101011234",
          dateOfBirth: "1980-01-01",
          dateOfIncorporation: null,
          gender: "MALE",
          nationality: "Malaysia",
          countryOfIncorporation: null,
          address: { line1: "10 Jalan C", state: "Selangor", postalCode: "47300" },
          shareType: "ORDINARY",
          shareTypeOther: null,
          shareholdingUnits: 100,
          shareholdingAmount: 100,
          shareholdingPercentage: 50,
        },
      ],
      board: [
        {
          partyKey: "800101011234",
          name: "Ali",
          personKind: "BOARD",
          identityPrefix: "NRIC",
          identityNumber: "800101011234",
          gender: "MALE",
          dateOfBirth: "1980-01-01",
          nationality: "Malaysia",
          address: { line1: "10 Jalan C", state: "Selangor", postalCode: "47300" },
          designation: "DIRECTOR_EXECUTIVE",
          designationOther: null,
          appointmentDate: "2020-01-15",
        },
      ],
      financials: issuerFinancialsFromYearBlock({
        bscatot: 1,
        bsclbank: 1,
        curlib_borrowing: 0,
        curlib_non_borrowing: 0,
        ncl_loan: 0,
        ncl_non_loan: 0,
        bsqpuc: 1,
        equity_accumulated_profit: 0,
        turnover: 1,
        operating_cost: 0,
        admin_cost: 0,
        interest_cost: 0,
        other_cost: 0,
        plnpbt: 1,
        plnpat: 1,
        plnetdiv: 0,
      }),
    });
    expect(result.complete).toBe(true);
    expect(result.percent).toBe(100);
    expect(result.steps.find((s) => s.id === "shareholders")?.requiredCount).toBe(14);
    expect(result.steps.find((s) => s.id === "board")?.requiredCount).toBe(12);
  });
});

describe("investor personal completeness [07000]", () => {
  it("requires state and postcode, not street", () => {
    const result = buildInvestorProfileCompleteness({
      organizationType: "PERSONAL",
      personal: {
        name: "Ali Bin Abu",
        identityPrefix: "NRIC",
        identityNumber: "800101011234",
        dateOfBirth: "1980-01-01",
        gender: "MALE",
        state: "Selangor",
        postalCode: "47300",
        nationality: "Malaysia",
        scInvestorCategory: "RETAIL",
      },
    });
    expect(result.complete).toBe(true);
    expect(result.missing.some((m) => m.field === "address.line1")).toBe(false);
  });
});

describe("master vs observation helpers", () => {
  it("does not treat an empty master as a mismatch equal to an external value", () => {
    expect(isMasterFieldEmpty("")).toBe(true);
    expect(isMasterFieldEmpty("Ali")).toBe(false);
    expect(valuesEqualForMismatch("36", 36)).toBe(true);
    expect(valuesEqualForMismatch("36.000000", 36)).toBe(true);
    expect(valuesEqualForMismatch("36", "38")).toBe(false);
    expect(valuesEqualForMismatch("01-12-2001", "2001-12-01")).toBe(true);
    expect(valuesEqualForMismatch("01-12-2001", "2001-01-12")).toBe(false);
  });
});

describe("operator annual [03000] holder type", () => {
  it("keeps regulatory role separate from individual vs corporate", () => {
    expect(OPERATOR_HOLDER_TYPES).toEqual(["SHAREHOLDER", "MEMBER", "BENEFICIAL_OWNER"]);
    expect(ORGANIZATION_PARTY_ENTITY_TYPES).toEqual(["INDIVIDUAL", "CORPORATE"]);
  });
});

describe("latestUnauditedYearKey", () => {
  it("picks the newest year from unaudited_by_year", () => {
    expect(
      latestUnauditedYearKey({
        unaudited_by_year: { "2023": { turnover: 1 }, "2025": { turnover: 2 } },
      })
    ).toBe("2025");
  });
});
