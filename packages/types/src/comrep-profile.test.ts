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
  mapRegTankEntityTypeToScCompanyType,
  resolveIssuerComrepEmail,
  resolveIssuerComrepPhone,
  ISSUER_FINANCIAL_REQUIRED_FIELD_COUNT,
  groupInvestorMissingByProfileSection,
  groupIssuerMissingByProfileSection,
  groupPeopleMissingByParty,
  issuerFinancialsFromYearBlock,
  issuerFlowStepComplete,
  isMasterFieldEmpty,
  latestUnauditedYearKey,
  missingItemsForIssuerFlowStep,
  OPERATOR_HOLDER_TYPES,
  ORGANIZATION_PARTY_ENTITY_TYPES,
  parseInvoiceOfferCampaignSector,
  resolveInvoiceCampaignSector,
  resolveInvoiceCompanyCategory,
  resolveInvoiceSustainabilityCategory,
  isIssuerOfficerRole,
  SC_INVESTMENT_RELATED_PARTIES,
  SC_INVESTMENT_RELATED_PARTY_LABELS,
  formatScPurposeOfFundRaisingDisplay,
  resolveApplicationPurposeOfFundRaising,
  SC_INVESTOR_CATEGORIES,
  SC_INVESTOR_CATEGORY_DEFINITIONS,
  SC_INVESTOR_CATEGORY_LABELS,
  SC_SUSTAINABILITY_CATEGORIES,
  scInvestorCategoryHelp,
  scInvestorCategoryAfterSophisticatedChange,
  appliesRegTankSophisticatedStatus,
  shouldShowOrganizationPersonalKycCard,
  typeOfInvestorValidationMessage,
  valuesEqualForMismatch,
} from "./comrep-profile";
import {
  ISSUER_PROFILE_BALANCE_SHEET_KEYS,
  ISSUER_PROFILE_PNL_KEYS,
} from "./financial-field-labels";

const FILLED_CONTACT = {
  contactPerson: { email: "ops@acme.test", contact: "+60123456789" },
} as const;

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
      ...FILLED_CONTACT,
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
      ...FILLED_CONTACT,
      companyActivities: null,
    });
    expect(missing.map((m) => m.field)).not.toContain("website");
    expect(missing.map((m) => m.field)).not.toContain("companyCategory");
    expect(missing.map((m) => m.field)).not.toContain("campaignSector");
    expect(missing.map((m) => m.field)).not.toContain("campaign_sector");
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
      contactPerson: { email: "   ", contact: "+60123456789" },
      companyActivities: null,
    });
    expect(missing.map((m) => m.field)).toEqual(["contactPersonEmail"]);
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
      contactPerson: { email: "not-an-email", contact: "+60123456789" },
      companyActivities: null,
    });
    expect(invalid.map((m) => m.field)).toEqual(["contactPersonEmail"]);
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
      ...FILLED_CONTACT,
      companyActivities: null,
    });
    expect(valid.map((m) => m.field)).not.toContain("contactPersonEmail");
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
      contactPerson: { email: "ops@acme.test", contact: "0182316817" },
      companyActivities: null,
    });
    expect(missing.map((m) => m.field)).not.toContain("contactPersonPhone");
  });

  it("uses Contact Person email/phone for ComRep and falls back to PIC only when empty", () => {
    expect(
      resolveIssuerComrepEmail({ email: "khai.kit@company.com" }, { email: "aisha@regtank.test" })
    ).toBe("khai.kit@company.com");
    expect(resolveIssuerComrepEmail({ email: "" }, { email: "aisha@regtank.test" })).toBe(
      "aisha@regtank.test"
    );
    expect(
      resolveIssuerComrepPhone({ contact: "+60122222222" }, { contactNumber: "+60111111111" })
    ).toBe("+60122222222");
    const fromPic = computeIssuerCompanyCompleteness({
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: "org_1",
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "Malaysia",
      scCompanyType: "PRIVATE_LIMITED",
      registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      businessAddress: { line1: "2 Jalan B", state: "Selangor", postalCode: "40000" },
      contactPerson: { email: "", contact: "" },
      personInCharge: { email: "aisha@regtank.test", contactNumber: "+60111111111" },
      companyActivities: null,
    });
    expect(fromPic).toHaveLength(0);
    const incomplete = computeIssuerCompanyCompleteness({
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: "org_1",
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "Malaysia",
      scCompanyType: "PRIVATE_LIMITED",
      registeredAddress: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      businessAddress: { line1: "2 Jalan B", state: "Selangor", postalCode: "40000" },
      companyActivities: null,
    });
    expect(incomplete.map((m) => m.field)).toEqual(
      expect.arrayContaining(["contactPersonEmail", "contactPersonPhone"])
    );
    expect(incomplete.map((m) => m.field)).not.toContain("companyEmail");
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
      ...FILLED_CONTACT,
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
        ...FILLED_CONTACT,
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
        ...FILLED_CONTACT,
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
        isSophisticatedInvestor: false,
      },
    });
    expect(result.complete).toBe(true);
    expect(result.userComplete).toBe(true);
    expect(result.missing.some((m) => m.field === "address.line1")).toBe(false);
  });

  it("does not require company-only incorporation fields on a personal investor", () => {
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
        isSophisticatedInvestor: false,
      },
    });
    expect(result.missing.map((item) => item.field)).not.toContain("dateOfIncorporation");
    expect(result.missing.map((item) => item.field)).not.toContain("registrationNumber");
    expect(result.missing.map((item) => item.field)).not.toContain("countryOfIncorporation");
    expect(result.missing.map((item) => item.field)).not.toContain("relatedParty");
    expect(result.missing.map((item) => item.field)).not.toContain("investmentByRelatedParty");
  });
});

describe("investor company completeness is not issuer Person completeness", () => {
  const completeCorporate = {
    name: "Acme Capital Sdn Bhd",
    registrationNumber: "202401000001",
    identityPrefix: "ROC" as const,
    dateOfIncorporation: "2020-01-01",
    countryOfIncorporation: "Malaysia",
    gender: "NOT_APPLICABLE" as const,
    businessState: "Selangor",
    businessPostalCode: "47300",
    scInvestorCategory: "NON_SOPHISTICATED_ENTITY" as const,
    isSophisticatedInvestor: false,
  };

  it("stays complete when a company-investor Person is missing issuer designation and share block", () => {
    const result = buildInvestorProfileCompleteness({
      organizationType: "COMPANY",
      corporate: completeCorporate,
    });
    expect(result.complete).toBe(true);
    expect(result.steps.some((step) => step.id === "shareholders" || step.id === "board")).toBe(false);
    expect(result.missing.map((item) => item.field)).not.toEqual(
      expect.arrayContaining(["designation", "shareType", "shareholdingUnits", "shareholdingAmount"])
    );
    expect(result.missing.some((item) => item.field === "campaignId")).toBe(false);
    expect(result.missing.some((item) => item.field === "issuerId")).toBe(false);
    expect(result.missing.some((item) => item.field === "relatedParty")).toBe(false);
    expect(result.missing.some((item) => item.field === "investmentByRelatedParty")).toBe(false);
  });

  it("remains incomplete for genuine Investor Details identity gaps", () => {
    const result = buildInvestorProfileCompleteness({
      organizationType: "COMPANY",
      corporate: {
        ...completeCorporate,
        name: "",
        dateOfIncorporation: null,
      },
    });
    expect(result.complete).toBe(false);
    expect(result.missing.map((item) => item.field)).toEqual(
      expect.arrayContaining(["name", "dateOfIncorporation"])
    );
    expect(result.missing.map((item) => item.field)).not.toContain("dateOfBirth");
  });

  it("does not list People as an Investor ComRep completeness section", () => {
    const rows = groupInvestorMissingByProfileSection([], "COMPANY");
    expect(rows.map((row) => row.id)).toEqual([
      "company",
      "addresses",
      "contact",
      "classification",
    ]);
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
      { step: "company" as const, field: "contactPersonEmail", label: "E-mail Address" },
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

  it("shows only HNWE and Accredited for a company sophisticated investor", () => {
    expect(
      allowedScInvestorCategories({
        organizationType: "COMPANY",
        isSophisticatedInvestor: true,
      })
    ).toEqual(["SOPHISTICATED_HIGH_NET_WORTH_ENTITY", "SOPHISTICATED_ACCREDITED"]);
  });

  it("shows only Non-sophisticated entity for a company non-sophisticated investor", () => {
    expect(
      allowedScInvestorCategories({
        organizationType: "COMPANY",
        isSophisticatedInvestor: false,
      })
    ).toEqual(["NON_SOPHISTICATED_ENTITY"]);
  });

  it("does not auto-select Type of Investor even when only one option is valid", () => {
    expect(
      scInvestorCategoryAfterSophisticatedChange(null, {
        organizationType: "COMPANY",
        isSophisticatedInvestor: false,
      })
    ).toBeNull();
  });

  it("hides Type of Investor options until Sophisticated Investor is chosen", () => {
    expect(
      allowedScInvestorCategories({
        organizationType: "PERSONAL",
        isSophisticatedInvestor: null,
      })
    ).toEqual([]);
    expect(
      allowedScInvestorCategories({
        organizationType: "COMPANY",
        isSophisticatedInvestor: undefined,
      })
    ).toEqual([]);
  });

  it("does not apply RegTank auto-sophisticated status to companies", () => {
    expect(appliesRegTankSophisticatedStatus("COMPANY")).toBe(false);
    expect(appliesRegTankSophisticatedStatus("PERSONAL")).toBe(true);
  });

  it("clears Type of Investor when Sophisticated status makes it invalid", () => {
    expect(
      scInvestorCategoryAfterSophisticatedChange("SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL", {
        organizationType: "PERSONAL",
        isSophisticatedInvestor: false,
      })
    ).toBeNull();
    expect(
      scInvestorCategoryAfterSophisticatedChange("SOPHISTICATED_HIGH_NET_WORTH_ENTITY", {
        organizationType: "COMPANY",
        isSophisticatedInvestor: false,
      })
    ).toBeNull();
    expect(
      scInvestorCategoryAfterSophisticatedChange("ANGEL", {
        organizationType: "PERSONAL",
        isSophisticatedInvestor: false,
      })
    ).toBe("ANGEL");
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
    expect(
      typeOfInvestorValidationMessage("SOPHISTICATED_ACCREDITED", {
        organizationType: "PERSONAL",
        isSophisticatedInvestor: false,
      })
    ).toBe("This Type of Investor is not valid for this organisation.");
  });

  it("rejects invalid company combinations", () => {
    expect(
      typeOfInvestorValidationMessage("RETAIL", {
        organizationType: "COMPANY",
        isSophisticatedInvestor: true,
      })
    ).toBe("This Type of Investor is not valid for this organisation.");
    expect(
      typeOfInvestorValidationMessage("ANGEL", {
        organizationType: "COMPANY",
        isSophisticatedInvestor: true,
      })
    ).toBe("This Type of Investor is not valid for this organisation.");
    expect(
      typeOfInvestorValidationMessage("SOPHISTICATED_HIGH_NET_WORTH_ENTITY", {
        organizationType: "COMPANY",
        isSophisticatedInvestor: false,
      })
    ).toBe("This Type of Investor is not valid for this organisation.");
    expect(
      typeOfInvestorValidationMessage("SOPHISTICATED_ACCREDITED", {
        organizationType: "COMPANY",
        isSophisticatedInvestor: false,
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
        isSophisticatedInvestor: false,
      },
    });
    expect(corporate.complete).toBe(false);
    expect(corporate.userComplete).toBe(false);
    expect(corporate.userMissing.map((item) => item.field)).toEqual(["scInvestorCategory"]);
    expect(corporate.missing.map((item) => item.field)).toContain("scInvestorCategory");
    expect(corporate.missing.find((item) => item.field === "scInvestorCategory")?.owner).toBe("USER");
  });

  it("counts blank Sophisticated Investor and Type of Investor as missing", () => {
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
        isSophisticatedInvestor: null,
      },
    });
    expect(personal.userMissing.map((item) => item.field)).toEqual([
      "isSophisticatedInvestor",
      "scInvestorCategory",
    ]);

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
        isSophisticatedInvestor: null,
      },
    });
    expect(corporate.userMissing.map((item) => item.field)).toEqual([
      "isSophisticatedInvestor",
      "scInvestorCategory",
    ]);
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
        isSophisticatedInvestor: false,
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
      { organizationType: "COMPANY" as const, isSophisticatedInvestor: false },
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
      { step: "company", field: "contactPersonPhone", label: "Phone Number" },
      { step: "shareholders", field: "gender", label: "Gender", partyKey: "p1" },
      { step: "financials", field: "revenue", label: "Total revenue and income" },
    ]);
    expect(rows.find((row) => row.id === "company")?.missingCount).toBe(1);
    expect(rows.find((row) => row.id === "about")?.missingCount).toBe(1);
    expect(rows.find((row) => row.id === "addresses")?.missingCount).toBe(1);
    expect(rows.find((row) => row.id === "contact")?.missingCount).toBe(1);
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

  it("reads Company category and Sustainability from invoice.details, not issuer profile", () => {
    expect(
      resolveInvoiceCompanyCategory({
        details: { company_category: "TECHNOLOGY" },
        offer_details: null,
      })
    ).toBe("TECHNOLOGY");
    expect(
      resolveInvoiceSustainabilityCategory({
        details: { sustainability_category: "G9" },
        offer_details: null,
      })
    ).toBe("G9");
    expect(
      resolveInvoiceCompanyCategory({
        details: { company_category: "NON_TECHNOLOGY" },
        offer_details: { company_category: "TECHNOLOGY" },
      })
    ).toBe("TECHNOLOGY");
  });

  it("reads Campaign Sector from invoice.details until offer freeze, then offer_details wins", () => {
    expect(
      resolveInvoiceCampaignSector({
        details: { campaign_sector: "CONSTRUCTIONS" },
        offer_details: null,
      })
    ).toBe("CONSTRUCTIONS");
    expect(
      resolveInvoiceCampaignSector({
        details: { campaign_sector: "CONSTRUCTIONS" },
        offer_details: { campaign_sector: "MANUFACTURING" },
      })
    ).toBe("MANUFACTURING");
    expect(
      resolveInvoiceCampaignSector({
        details: { industry: "Manufacturing" },
        offer_details: null,
      })
    ).toBeNull();
  });

  it("lets two invoices of the same issuer keep independent classification values", () => {
    const invoiceA = {
      details: {
        company_category: "TECHNOLOGY",
        campaign_sector: "MANUFACTURING",
        sustainability_category: "G8",
      },
    };
    const invoiceB = {
      details: {
        company_category: "NON_TECHNOLOGY",
        campaign_sector: "CONSTRUCTIONS",
        sustainability_category: "NONE",
      },
    };
    expect(resolveInvoiceCompanyCategory(invoiceA)).toBe("TECHNOLOGY");
    expect(resolveInvoiceCompanyCategory(invoiceB)).toBe("NON_TECHNOLOGY");
    expect(resolveInvoiceCampaignSector(invoiceA)).toBe("MANUFACTURING");
    expect(resolveInvoiceCampaignSector(invoiceB)).toBe("CONSTRUCTIONS");
    expect(resolveInvoiceSustainabilityCategory(invoiceA)).toBe("G8");
    expect(resolveInvoiceSustainabilityCategory(invoiceB)).toBe("NONE");
  });

  it("does not default Sustainability Category to 00 – None", () => {
    expect(resolveInvoiceSustainabilityCategory({ details: {}, offer_details: null })).toBeNull();
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
        ...FILLED_CONTACT,
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
  it("maps only confirmed exact RegTank Type of Entity strings", () => {
    expect(mapRegTankEntityTypeToScCompanyType("Private Limited Company (Sdn Bhd)")).toBe(
      "PRIVATE_LIMITED"
    );
    expect(mapRegTankEntityTypeToScCompanyType("Limited Liability Partnerships")).toBe("LLP");
    expect(mapRegTankEntityTypeToScCompanyType("Unlisted Public Company")).toBeNull();
    expect(mapRegTankEntityTypeToScCompanyType("Foreign")).toBeNull();
    expect(mapRegTankEntityTypeToScCompanyType("Something unknown")).toBeNull();
    expect(displayScCompanyTypeLabel("LLP")).toBe("Limited Liability Partnership");
    expect(displayScCompanyTypeLabel(null, "Limited Liability Partnerships")).toBeNull();
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

  it("still requires monthly [05000] share fields on an issuer shareholder", () => {
    const missing = computeIssuerPersonCompleteness({
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
      nationality: "MALAYSIA",
      countryOfIncorporation: null,
      address: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      shareType: null,
      shareTypeOther: null,
      shareholdingUnits: null,
      shareholdingAmount: null,
      shareholdingPercentage: "25",
      designation: null,
      designationOther: null,
      appointmentDate: null,
    });
    expect(missing.map((item) => item.field)).toEqual(
      expect.arrayContaining(["shareType", "shareholdingUnits", "shareholdingAmount"])
    );
    expect(missing.map((item) => item.field)).not.toContain("designation");
    expect(missing.map((item) => item.field)).not.toContain("dateAcquired");
  });

  it("still requires monthly [06000] Designation on issuer Board/Management", () => {
    const missing = computeIssuerPersonCompleteness({
      partyKey: "800101011234",
      name: "Ali",
      entityType: "INDIVIDUAL",
      isDirector: false,
      isShareholder: false,
      isBoard: true,
      isManagement: false,
      identityPrefix: "NRIC",
      identityNumber: "800101011234",
      dateOfBirth: "1980-01-01",
      dateOfIncorporation: null,
      gender: "MALE",
      nationality: "MALAYSIA",
      countryOfIncorporation: null,
      address: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
      shareType: null,
      shareTypeOther: null,
      shareholdingUnits: null,
      shareholdingAmount: null,
      shareholdingPercentage: null,
      designation: null,
      designationOther: null,
      appointmentDate: "2020-01-01",
    });
    expect(missing.map((item) => item.field)).toContain("designation");
    expect(missing.map((item) => item.field)).not.toContain("shareType");
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
      ...FILLED_CONTACT,
      companyActivities: null,
    });
    expect(missing.map((item) => item.field)).not.toContain("contactPersonEmail");
    expect(missing.map((item) => item.field)).not.toContain("companyEmail");
  });
});

describe("person role independence", () => {
  it("does not treat Director as Board of Director for [06000]", () => {
    expect(isIssuerOfficerRole({ isBoard: false, isManagement: false })).toBe(false);
    expect(isIssuerOfficerRole({ isBoard: true, isManagement: false })).toBe(true);
    expect(isIssuerOfficerRole({ isBoard: false, isManagement: true })).toBe(true);
  });
});

describe("Investment by Related Party [07000]", () => {
  it("keeps the SC four-value list off investor profile completeness", () => {
    expect(SC_INVESTMENT_RELATED_PARTIES).toEqual([
      "SHAREHOLDER_OF_RMO",
      "RELATED_CO_OF_RMO",
      "OFFICER_OF_RMO",
      "NOT_APPLICABLE",
    ]);
    expect(SC_INVESTMENT_RELATED_PARTY_LABELS.SHAREHOLDER_OF_RMO).toBe("Shareholder of the RMO");
    expect(SC_INVESTMENT_RELATED_PARTY_LABELS.RELATED_CO_OF_RMO).toBe("Related co of the RMO");
    expect(SC_INVESTMENT_RELATED_PARTY_LABELS.OFFICER_OF_RMO).toBe("Officer of the RMO");
    expect(SC_INVESTMENT_RELATED_PARTY_LABELS.NOT_APPLICABLE).toBe("Not applicable");
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
