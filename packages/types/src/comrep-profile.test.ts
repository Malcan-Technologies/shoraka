import {
  allowedScInvestorCategories,
  buildInvestorProfileCompleteness,
  buildIssuerProfileCompleteness,
  computeIssuerCompanyCompleteness,
  computeIssuerFinancialCompleteness,
  computeIssuerPersonCompleteness,
  computeShareholderCompleteness,
  displayScCompanyTypeLabel,
  ISSUER_COMPANY_COMPLETENESS_FIELD_COUNT,
  ISSUER_FINANCIAL_REQUIRED_FIELD_COUNT,
  groupInvestorMissingByProfileSection,
  groupIssuerMissingByProfileSection,
  groupPeopleMissingByParty,
  issuerFinancialsFromYearBlock,
  issuerFlowStepComplete,
  isMasterFieldEmpty,
  latestUnauditedYearKey,
  mapRegTankEntityTypeToScCompanyType,
  missingItemsForIssuerFlowStep,
  OPERATOR_HOLDER_TYPES,
  ORGANIZATION_PARTY_ENTITY_TYPES,
  parseInvoiceOfferCampaignSector,
  formatScPurposeOfFundRaisingDisplay,
  resolveApplicationPurposeOfFundRaising,
  SC_INVESTOR_CATEGORIES,
  SC_INVESTOR_CATEGORY_DEFINITIONS,
  SC_INVESTOR_CATEGORY_LABELS,
  SC_SUSTAINABILITY_CATEGORIES,
  scInvestorCategoryHelp,
  shouldShowOrganizationPersonalKycCard,
  typeOfInvestorValidationMessage,
  valuesEqualForMismatch,
} from "./comrep-profile";
import {
  ISSUER_PROFILE_BALANCE_SHEET_KEYS,
  ISSUER_PROFILE_PNL_KEYS,
} from "./financial-field-labels";

describe("issuer company completeness [02000]", () => {
  it("requires registered and business line1, state, and postcode", () => {
    const missing = computeIssuerCompanyCompleteness({
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: "org_1",
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

  it("does not require website, city, TIN, Issuer ID, or company activities", () => {
    const missing = computeIssuerCompanyCompleteness({
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: null,
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "Malaysia",
      scCompanyType: "PRIVATE_LIMITED",
      registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      businessAddress: { line1: "2 Jalan B", state: "Selangor", postalCode: "40000" },
      phoneNumber: "+60123456789",
      companyEmail: "ops@acme.test",
      companyActivities: null,
    });
    expect(missing.map((m) => m.field)).not.toContain("website");
    expect(missing.map((m) => m.field)).not.toContain("companyCategory");
    expect(missing.map((m) => m.field)).not.toContain("organizationId");
    expect(missing.map((m) => m.field)).not.toContain("companyActivities");
    expect(missing).toHaveLength(0);
  });

  it("counts 14 company completeness fields when empty", () => {
    const missing = computeIssuerCompanyCompleteness({
      name: null,
      registrationNumber: null,
      organizationId: null,
      dateOfIncorporation: null,
      dateOfCommencement: null,
      countryOfIncorporation: null,
      scCompanyType: null,
      registeredAddress: null,
      businessAddress: null,
      phoneNumber: null,
      companyEmail: null,
      companyActivities: null,
    });
    expect(missing).toHaveLength(ISSUER_COMPANY_COMPLETENESS_FIELD_COUNT);
  });

  it("treats blank E-mail Address as a company completeness blocker", () => {
    const missing = computeIssuerCompanyCompleteness({
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: "org_1",
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "Malaysia",
      scCompanyType: "PRIVATE_LIMITED",
      registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      businessAddress: { line1: "2 Jalan B", state: "Selangor", postalCode: "40000" },
      phoneNumber: "+60123456789",
      companyEmail: "   ",
      companyActivities: null,
    });
    expect(missing.map((m) => m.field)).toEqual(["companyEmail"]);
  });

  it("CASE F: invalid e-mail is missing; a valid e-mail is not", () => {
    const invalid = computeIssuerCompanyCompleteness({
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: "org_1",
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "Malaysia",
      scCompanyType: "PRIVATE_LIMITED",
      registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      businessAddress: { line1: "2 Jalan B", state: "Selangor", postalCode: "40000" },
      phoneNumber: "+60123456789",
      companyEmail: "not-an-email",
      companyActivities: null,
    });
    expect(invalid.map((m) => m.field)).toEqual(["companyEmail"]);
    const valid = computeIssuerCompanyCompleteness({
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: "org_1",
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "Malaysia",
      scCompanyType: "PRIVATE_LIMITED",
      registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      businessAddress: { line1: "2 Jalan B", state: "Selangor", postalCode: "40000" },
      phoneNumber: "+60123456789",
      companyEmail: "ops@acme.test",
      companyActivities: null,
    });
    expect(valid.map((m) => m.field)).not.toContain("companyEmail");
  });

  it("CASE D: a local Malaysian phone is complete", () => {
    const missing = computeIssuerCompanyCompleteness({
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: "org_1",
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "Malaysia",
      scCompanyType: "PRIVATE_LIMITED",
      registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      businessAddress: { line1: "2 Jalan B", state: "Selangor", postalCode: "40000" },
      phoneNumber: "0182316817",
      companyEmail: "ops@acme.test",
      companyActivities: null,
    });
    expect(missing.map((m) => m.field)).not.toContain("phoneNumber");
  });

  it("does not require postcode when State is Outside Malaysia", () => {
    const missing = computeIssuerCompanyCompleteness({
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: "org_1",
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "SINGAPORE",
      scCompanyType: "FOREIGN",
      registeredAddress: { line1: "1 Overseas Rd", state: "Outside Malaysia", postalCode: "" },
      businessAddress: { line1: "2 Overseas Rd", state: "Outside Malaysia", postalCode: null },
      phoneNumber: "+60123456789",
      companyEmail: "ops@acme.test",
      companyActivities: null,
    });
    expect(missing.map((m) => m.field)).not.toContain("registeredAddress.postalCode");
    expect(missing.map((m) => m.field)).not.toContain("businessAddress.postalCode");
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
        pl_minority: 0,
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
    expect(result.userComplete).toBe(true);
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

describe("issuer profile flow grouping", () => {
  const completeness = {
    portal: "issuer" as const,
    organizationType: "COMPANY" as const,
    complete: false,
    percent: 70,
    steps: [],
    missing: [
      { step: "company" as const, field: "companyEmail", label: "E-mail address" },
      { step: "shareholders" as const, field: "shareType", label: "Type of shares", partyKey: "a", partyName: "Max" },
      { step: "board" as const, field: "designation", label: "Designation", partyKey: "b", partyName: "Sarah" },
      { step: "financials" as const, field: "revenue", label: "Total revenue" },
    ],
  };

  it("maps shareholder and board gaps onto one People step", () => {
    const people = missingItemsForIssuerFlowStep(completeness, "people");
    expect(people).toHaveLength(2);
    expect(issuerFlowStepComplete(completeness, "company")).toBe(false);
    expect(groupPeopleMissingByParty(people).map((g) => g.partyName)).toEqual(["Max", "Sarah"]);
  });
});

describe("shareholder identity prefix vs entity type", () => {
  it("does not accept ROC on an individual or NRIC on a company", () => {
    const individual = computeShareholderCompleteness({
      partyKey: "1",
      name: "Ali",
      entityType: "INDIVIDUAL",
      identityPrefix: "ROC",
      identityNumber: "800101011234",
      dateOfBirth: "1980-01-01",
      dateOfIncorporation: null,
      gender: "MALE",
      nationality: "MALAYSIA",
      countryOfIncorporation: null,
      address: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      shareType: "ORDINARY",
      shareTypeOther: null,
      shareholdingUnits: 10,
      shareholdingAmount: 10,
      shareholdingPercentage: 10,
    });
    expect(individual.map((item) => item.field)).toContain("identityPrefix");

    const company = computeShareholderCompleteness({
      partyKey: "2",
      name: "HoldCo",
      entityType: "CORPORATE",
      identityPrefix: "NRIC",
      identityNumber: "1234567A",
      dateOfBirth: null,
      dateOfIncorporation: "2010-01-01",
      gender: "NOT_APPLICABLE",
      nationality: null,
      countryOfIncorporation: "MALAYSIA",
      address: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      shareType: "ORDINARY",
      shareTypeOther: null,
      shareholdingUnits: 10,
      shareholdingAmount: 10,
      shareholdingPercentage: 10,
    });
    expect(company.map((item) => item.field)).toContain("identityPrefix");
  });
});

describe("campaign sustainability category [03000]", () => {
  it("includes None and G1–G17", () => {
    expect(SC_SUSTAINABILITY_CATEGORIES[0]).toBe("NONE");
    expect(SC_SUSTAINABILITY_CATEGORIES).toHaveLength(18);
    expect(SC_SUSTAINABILITY_CATEGORIES[17]).toBe("G17");
  });
});

describe("SC ComRep investor category", () => {
  it("shows only HNWI and Accredited for a personal sophisticated investor", () => {
    expect(
      allowedScInvestorCategories({
        organizationType: "PERSONAL",
        isSophisticatedInvestor: true,
      })
    ).toEqual(["SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL", "SOPHISTICATED_ACCREDITED"]);
  });

  it("shows only Angel and Retail for a personal non-sophisticated investor", () => {
    expect(
      allowedScInvestorCategories({
        organizationType: "PERSONAL",
        isSophisticatedInvestor: false,
      })
    ).toEqual(["ANGEL", "RETAIL"]);
  });

  it("shows only HNWE and Non-sophisticated entity for a company", () => {
    expect(
      allowedScInvestorCategories({
        organizationType: "COMPANY",
        isSophisticatedInvestor: true,
      })
    ).toEqual(["SOPHISTICATED_HIGH_NET_WORTH_ENTITY", "NON_SOPHISTICATED_ENTITY"]);
  });

  it("does not treat company auto-Sophisticated Yes as HNWE-only", () => {
    expect(
      allowedScInvestorCategories({
        organizationType: "COMPANY",
        isSophisticatedInvestor: true,
      })
    ).not.toEqual(["SOPHISTICATED_HIGH_NET_WORTH_ENTITY"]);
  });

  it("rejects invalid personal combinations", () => {
    expect(
      typeOfInvestorValidationMessage("RETAIL", {
        organizationType: "PERSONAL",
        isSophisticatedInvestor: true,
      })
    ).toBe("This Type of Investor is not valid for this organisation.");
    expect(
      typeOfInvestorValidationMessage("SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL", {
        organizationType: "PERSONAL",
        isSophisticatedInvestor: false,
      })
    ).toBe("This Type of Investor is not valid for this organisation.");
  });

  it("rejects invalid company combinations", () => {
    expect(
      typeOfInvestorValidationMessage("RETAIL", { organizationType: "COMPANY" })
    ).toBe("This Type of Investor is not valid for this organisation.");
    expect(
      typeOfInvestorValidationMessage("ANGEL", {
        organizationType: "COMPANY",
        isSophisticatedInvestor: true,
      })
    ).toBe("This Type of Investor is not valid for this organisation.");
  });

  it("requires an explicit SC category for user completeness now that investors can set it", () => {
    const personal = buildInvestorProfileCompleteness({
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
        scInvestorCategory: null,
        isSophisticatedInvestor: false,
      },
    });
    expect(personal.complete).toBe(false);
    expect(personal.userComplete).toBe(false);
    expect(personal.userMissing.map((item) => item.field)).toEqual(["scInvestorCategory"]);
    expect(personal.missing.map((item) => item.field)).toContain("scInvestorCategory");
    expect(personal.missing.find((item) => item.field === "scInvestorCategory")?.owner).toBe("USER");

    const corporate = buildInvestorProfileCompleteness({
      organizationType: "COMPANY",
      corporate: {
        name: "Acme Capital Sdn Bhd",
        registrationNumber: "202401000001",
        identityPrefix: "ROC",
        dateOfIncorporation: "2020-01-01",
        countryOfIncorporation: "Malaysia",
        gender: "NOT_APPLICABLE",
        businessState: "Selangor",
        businessPostalCode: "47300",
        scInvestorCategory: null,
      },
    });
    expect(corporate.complete).toBe(false);
    expect(corporate.userComplete).toBe(false);
    expect(corporate.userMissing.map((item) => item.field)).toEqual(["scInvestorCategory"]);
    expect(corporate.missing.map((item) => item.field)).toContain("scInvestorCategory");
    expect(corporate.missing.find((item) => item.field === "scInvestorCategory")?.owner).toBe("USER");
  });

  it("keeps user completeness incomplete when an investor-editable field is missing", () => {
    const personal = buildInvestorProfileCompleteness({
      organizationType: "PERSONAL",
      personal: {
        name: "Ali Bin Abu",
        identityPrefix: "NRIC",
        identityNumber: "800101011234",
        dateOfBirth: "1980-01-01",
        gender: null,
        state: "Selangor",
        postalCode: "47300",
        nationality: "Malaysia",
        scInvestorCategory: "RETAIL",
        isSophisticatedInvestor: false,
      },
    });
    expect(personal.complete).toBe(false);
    expect(personal.userComplete).toBe(false);
    expect(personal.userMissing.map((item) => item.field)).toEqual(["gender"]);
    expect(personal.userMissing[0]?.owner ?? "USER").toBe("USER");
  });

  it("counts an invalid personal Type of Investor as missing", () => {
    const personal = buildInvestorProfileCompleteness({
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
        isSophisticatedInvestor: true,
      },
    });
    expect(personal.userMissing.map((item) => item.field)).toEqual(["scInvestorCategory"]);
  });

  it("keeps an existing valid Type of Investor complete", () => {
    const personal = buildInvestorProfileCompleteness({
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
        scInvestorCategory: "ANGEL",
        isSophisticatedInvestor: false,
      },
    });
    expect(personal.complete).toBe(true);
    expect(personal.userComplete).toBe(true);

    const sophisticatedPersonal = buildInvestorProfileCompleteness({
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
        scInvestorCategory: "SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL",
        isSophisticatedInvestor: true,
      },
    });
    expect(sophisticatedPersonal.complete).toBe(true);

    const corporate = buildInvestorProfileCompleteness({
      organizationType: "COMPANY",
      corporate: {
        name: "Acme Capital Sdn Bhd",
        registrationNumber: "202401000001",
        identityPrefix: "ROC",
        dateOfIncorporation: "2020-01-01",
        countryOfIncorporation: "Malaysia",
        gender: "NOT_APPLICABLE",
        businessState: "Selangor",
        businessPostalCode: "47300",
        scInvestorCategory: "NON_SOPHISTICATED_ENTITY",
      },
    });
    expect(corporate.complete).toBe(true);
    expect(corporate.userComplete).toBe(true);
  });

  it("exposes tooltip definitions for every displayed Type of Investor option", () => {
    for (const category of SC_INVESTOR_CATEGORIES) {
      expect(SC_INVESTOR_CATEGORY_DEFINITIONS[category].length).toBeGreaterThan(0);
    }

    const scopes = [
      { organizationType: "PERSONAL" as const, isSophisticatedInvestor: true },
      { organizationType: "PERSONAL" as const, isSophisticatedInvestor: false },
      { organizationType: "COMPANY" as const, isSophisticatedInvestor: true },
    ];
    for (const scope of scopes) {
      const options = allowedScInvestorCategories(scope);
      const help = scInvestorCategoryHelp(options);
      for (const option of options) {
        expect(help).toContain(SC_INVESTOR_CATEGORY_LABELS[option]);
        expect(help).toContain(SC_INVESTOR_CATEGORY_DEFINITIONS[option]);
      }
    }
  });
});

describe("profile UI section grouping", () => {
  it("groups issuer missing items by profile cards without changing labels", () => {
    const rows = groupIssuerMissingByProfileSection([
      { step: "company", field: "dateOfIncorporation", label: "Date of incorporation" },
      { step: "company", field: "companyActivities", label: "Company activities" },
      { step: "company", field: "registeredAddress.state", label: "Registered address — state" },
      { step: "company", field: "phoneNumber", label: "Phone number" },
      { step: "shareholders", field: "gender", label: "Gender", partyKey: "p1" },
      { step: "financials", field: "revenue", label: "Total revenue and income" },
    ]);
    expect(rows.find((row) => row.id === "company")?.missingCount).toBe(2);
    expect(rows.find((row) => row.id === "about")?.missingCount).toBe(1);
    expect(rows.find((row) => row.id === "addresses")?.missingCount).toBe(1);
    expect(rows.find((row) => row.id === "contact")?.missingCount).toBe(0);
    expect(rows.find((row) => row.id === "people")?.missingCount).toBe(1);
    expect(rows.find((row) => row.id === "financials")?.missingCount).toBe(1);
  });

  it("groups investor personal missing items onto Personal Details and Address", () => {
    const rows = groupInvestorMissingByProfileSection(
      [
        { step: "identity", field: "gender", label: "Gender" },
        { step: "identity", field: "state", label: "Address — state" },
      ],
      "PERSONAL"
    );
    expect(rows.find((row) => row.id === "personal")?.missingCount).toBe(1);
    expect(rows.find((row) => row.id === "addresses")?.missingCount).toBe(1);
  });

  it("groups SC ComRep investor type onto classification", () => {
    const rows = groupInvestorMissingByProfileSection(
      [{ step: "identity", field: "scInvestorCategory", label: "SC ComRep investor type" }],
      "PERSONAL"
    );
    expect(rows.find((row) => row.id === "classification")?.missingCount).toBe(1);
    expect(rows.find((row) => row.id === "personal")?.missingCount).toBe(0);
  });
});

describe("campaign SC enums", () => {
  it("parses campaign sector from offer_details without treating issuer industry as equivalent", () => {
    expect(parseInvoiceOfferCampaignSector({ campaign_sector: "MANUFACTURING" })).toBe("MANUFACTURING");
    expect(parseInvoiceOfferCampaignSector({ industry: "Manufacturing" })).toBeNull();
    expect(parseInvoiceOfferCampaignSector({ company_category: "TECHNOLOGY" })).toBeNull();
  });
});

describe("issuer profile financial editor keys", () => {
  it("exposes stored SC master keys including previously missing equity and P&L minority fields", () => {
    expect(ISSUER_PROFILE_BALANCE_SHEET_KEYS).toEqual(
      expect.arrayContaining([
        "equity_share_application",
        "equity_share_premium",
        "equity_minority",
      ])
    );
    expect(ISSUER_PROFILE_PNL_KEYS).toEqual(expect.arrayContaining(["pl_minority"]));
  });

  it("does not make share application, share premium, or minority interest mandatory", () => {
    const filled = issuerFinancialsFromYearBlock({
      bscatot: 1,
      bsclbank: 1,
      curlib_borrowing: 1,
      curlib_non_borrowing: 1,
      ncl_loan: 1,
      ncl_non_loan: 1,
      bsqpuc: 1,
      equity_accumulated_profit: 1,
      turnover: 1,
      operating_cost: 1,
      admin_cost: 1,
      interest_cost: 1,
      other_cost: 1,
      plnpbt: 1,
      plnpat: 1,
      pl_minority: 0,
      plnetdiv: 1,
    });
    expect(computeIssuerFinancialCompleteness(filled).map((item) => item.field)).toEqual([]);
  });

  it("counts every required financial field when no year block exists (scenario F)", () => {
    expect(computeIssuerFinancialCompleteness(null)).toHaveLength(ISSUER_FINANCIAL_REQUIRED_FIELD_COUNT);
    const result = buildIssuerProfileCompleteness({
      company: {
        name: "Acme Sdn Bhd",
        registrationNumber: "1234567A",
        organizationId: "org_1",
        dateOfIncorporation: "2020-01-01",
        dateOfCommencement: "2020-02-01",
        countryOfIncorporation: "Malaysia",
        scCompanyType: "PRIVATE_LIMITED",
        registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
        businessAddress: { line1: "2 Jalan B", state: "Selangor", postalCode: "40000" },
        phoneNumber: "+60123456789",
        companyEmail: "ops@acme.test",
        companyActivities: null,
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
      board: [],
      people: [
        {
          partyKey: "800101011234",
          name: "Ali",
          entityType: "INDIVIDUAL",
          isDirector: false,
          isShareholder: true,
          isBoard: false,
          isManagement: false,
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
          designation: null,
          designationOther: null,
          appointmentDate: null,
        },
      ],
      financials: null,
    });
    expect(result.missing.filter((item) => item.step === "financials")).toHaveLength(
      ISSUER_FINANCIAL_REQUIRED_FIELD_COUNT
    );
  });
});

describe("company type mapping and personal KYC visibility", () => {
  it("maps Limited Liability Partnerships to LLP and does not display the raw RegTank label", () => {
    expect(mapRegTankEntityTypeToScCompanyType("Limited Liability Partnerships")).toBe("LLP");
    expect(displayScCompanyTypeLabel(null, "Limited Liability Partnerships")).toBe(
      "Limited Liability Partnership"
    );
    expect(displayScCompanyTypeLabel(null, "Something unknown")).toBeNull();
  });

  it("hides organisation Personal Details (KYC) for company organisations (scenario G)", () => {
    expect(shouldShowOrganizationPersonalKycCard("COMPANY")).toBe(false);
    expect(shouldShowOrganizationPersonalKycCard("PERSONAL")).toBe(true);
  });
});

describe("people completeness by actual role", () => {
  it("counts Gender, Nationality, and Date of Birth once for a director (scenario E)", () => {
    const person = {
      partyKey: "950829083430",
      name: "Nur Aina Farisha Binti Salleh",
      entityType: "INDIVIDUAL" as const,
      isDirector: true,
      isShareholder: false,
      isBoard: false,
      isManagement: false,
      identityPrefix: "NRIC" as const,
      identityNumber: "950829083430",
      dateOfBirth: null,
      dateOfIncorporation: null,
      gender: null,
      nationality: null,
      countryOfIncorporation: null,
      address: { line1: "1 Jalan A", state: "Selangor", postalCode: "47800" },
      shareType: null,
      shareTypeOther: null,
      shareholdingUnits: null,
      shareholdingAmount: null,
      shareholdingPercentage: null,
      designation: null,
      designationOther: null,
      appointmentDate: null,
    };
    const missing = computeIssuerPersonCompleteness(person);
    expect(missing.map((item) => item.field).sort()).toEqual([
      "dateOfBirth",
      "gender",
      "nationality",
    ]);
    expect(missing).toHaveLength(3);
    expect(missing.some((item) => item.field === "designation")).toBe(false);
  });

  it("does not treat a director as Board and does not double-count shared identity fields", () => {
    const person = {
      partyKey: "950829083430",
      name: "Nur Aina Farisha Binti Salleh",
      entityType: "INDIVIDUAL" as const,
      isDirector: true,
      isShareholder: true,
      isBoard: false,
      isManagement: false,
      identityPrefix: "NRIC" as const,
      identityNumber: "950829083430",
      dateOfBirth: null,
      dateOfIncorporation: null,
      gender: null,
      nationality: null,
      countryOfIncorporation: null,
      address: { line1: "1 Jalan A", state: "Selangor", postalCode: "47800" },
      shareType: "ORDINARY" as const,
      shareTypeOther: null,
      shareholdingUnits: 6,
      shareholdingAmount: 6,
      shareholdingPercentage: 6,
      designation: null,
      designationOther: null,
      appointmentDate: null,
    };
    const missing = computeIssuerPersonCompleteness(person);
    expect(missing.filter((item) => item.field === "dateOfBirth")).toHaveLength(1);
    expect(missing.filter((item) => item.field === "gender")).toHaveLength(1);
    expect(missing.some((item) => item.field === "designation")).toBe(false);
    expect(missing.map((item) => item.field).sort()).toEqual([
      "dateOfBirth",
      "gender",
      "nationality",
    ]);
  });

  it("does not count individual DOB or Gender for a corporate shareholder", () => {
    const missing = computeIssuerPersonCompleteness({
      partyKey: "202001234567",
      name: "ApexStar Holdings Sdn. Bhd.",
      entityType: "CORPORATE",
      isDirector: false,
      isShareholder: true,
      isBoard: false,
      isManagement: false,
      identityPrefix: "ROC",
      identityNumber: "202001234567",
      dateOfBirth: null,
      dateOfIncorporation: "2020-01-01",
      gender: "NOT_APPLICABLE",
      nationality: null,
      countryOfIncorporation: "Malaysia",
      address: { line1: "10 Jalan Apex", state: "Selangor", postalCode: "47800" },
      shareType: "ORDINARY",
      shareTypeOther: null,
      shareholdingUnits: 10,
      shareholdingAmount: 10,
      shareholdingPercentage: 10,
      designation: null,
      designationOther: null,
      appointmentDate: null,
    });
    expect(missing.map((item) => item.field)).not.toContain("dateOfBirth");
    expect(missing.map((item) => item.field)).not.toContain("gender");
    expect(missing.map((item) => item.field)).not.toContain("nationality");
  });

  it("does not count hidden Gender when a company shareholder has no gender stored", () => {
    const missing = computeIssuerPersonCompleteness({
      partyKey: "202001234567",
      name: "ApexStar Holdings Sdn. Bhd.",
      entityType: "CORPORATE",
      isDirector: false,
      isShareholder: true,
      isBoard: false,
      isManagement: false,
      identityPrefix: "ROC",
      identityNumber: "202001234567",
      dateOfBirth: null,
      dateOfIncorporation: "2020-01-01",
      gender: null,
      nationality: null,
      countryOfIncorporation: "Malaysia",
      address: { line1: "10 Jalan Apex", state: "Selangor", postalCode: "47800" },
      shareType: "ORDINARY",
      shareTypeOther: null,
      shareholdingUnits: 10,
      shareholdingAmount: 10,
      shareholdingPercentage: 10,
      designation: null,
      designationOther: null,
      appointmentDate: null,
    });
    expect(missing.map((item) => item.field)).not.toContain("gender");
  });

  it("counts populated company email as filled (scenario B)", () => {
    const missing = computeIssuerCompanyCompleteness({
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: "org_1",
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "Malaysia",
      scCompanyType: "LLP",
      registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      businessAddress: { line1: "2 Jalan B", state: "Selangor", postalCode: "40000" },
      phoneNumber: "+60123456789",
      companyEmail: "ops@acme.test",
      companyActivities: null,
    });
    expect(missing.map((item) => item.field)).not.toContain("companyEmail");
  });
});

describe("Purpose of Fund Raising display", () => {
  it("formats SC enums and Others text", () => {
    expect(formatScPurposeOfFundRaisingDisplay("WORKING_CAPITAL")).toBe("Working Capital");
    expect(formatScPurposeOfFundRaisingDisplay("BUSINESS_EXPANSION")).toBe("Business Expansion");
    expect(formatScPurposeOfFundRaisingDisplay("OTHERS", "Construction of a warehouse")).toBe(
      "Others: Construction of a warehouse"
    );
    expect(formatScPurposeOfFundRaisingDisplay("OTHERS", "  ")).toBe("Others");
    expect(formatScPurposeOfFundRaisingDisplay("not-an-enum")).toBeNull();
  });

  it("prefers SC purpose over legacy financing_for and falls back when SC is absent", () => {
    expect(
      resolveApplicationPurposeOfFundRaising({
        sc_purpose_of_fund_raising: "WORKING_CAPITAL",
        financing_for: "Expand warehouse capacity",
      })
    ).toBe("Working Capital");
    expect(
      resolveApplicationPurposeOfFundRaising({
        financing_for: "  Expand warehouse capacity  ",
      })
    ).toBe("Expand warehouse capacity");
    expect(resolveApplicationPurposeOfFundRaising({})).toBeNull();
  });
});
