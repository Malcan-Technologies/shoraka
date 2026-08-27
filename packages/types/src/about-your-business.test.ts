import {
  emptyAboutYourBusiness,
  isAboutYourBusinessComplete,
  isAboutYourBusinessPresent,
  parseAboutYourBusiness,
  parseAboutYourBusinessFromBusinessDetails,
  parseAboutYourBusinessFromCorporateData,
} from "./about-your-business";

describe("parseAboutYourBusiness", () => {
  it("reads camelCase COD fields", () => {
    expect(
      parseAboutYourBusiness({
        whatDoesCompanyDo: "We manufacture equipment.",
        mainCustomers: "Miners",
        singleCustomerOver50Revenue: false,
        accountingSoftware: "Xero",
      })
    ).toEqual({
      whatDoesCompanyDo: "We manufacture equipment.",
      mainCustomers: "Miners",
      singleCustomerOver50Revenue: false,
      accountingSoftware: "Xero",
    });
  });

  it("reads snake_case and yes/no strings", () => {
    expect(
      parseAboutYourBusiness({
        what_does_company_do: "Trade",
        main_customers: "Retail",
        single_customer_over_50_revenue: "yes",
        accounting_software: "SAP",
      })
    ).toEqual({
      whatDoesCompanyDo: "Trade",
      mainCustomers: "Retail",
      singleCustomerOver50Revenue: true,
      accountingSoftware: "SAP",
    });
  });

  it("returns empty defaults for missing input", () => {
    expect(parseAboutYourBusiness(undefined)).toEqual(emptyAboutYourBusiness());
  });
});

describe("parseAboutYourBusinessFromBusinessDetails", () => {
  it("pulls accounting software from why_raising_funds", () => {
    const parsed = parseAboutYourBusinessFromBusinessDetails({
      about_your_business: {
        what_does_company_do: "Wholesale",
        main_customers: "Chains",
        single_customer_over_50_revenue: false,
      },
      why_raising_funds: { accounting_software: "Xero" },
    });
    expect(parsed.accountingSoftware).toBe("Xero");
    expect(parsed.whatDoesCompanyDo).toBe("Wholesale");
  });
});

describe("parseAboutYourBusinessFromCorporateData", () => {
  it("reads nested aboutYourBusiness", () => {
    const parsed = parseAboutYourBusinessFromCorporateData({
      basicInfo: { industry: "Manufacturing" },
      aboutYourBusiness: { whatDoesCompanyDo: "Makes parts", accountingSoftware: "Xero" },
    });
    expect(parsed.whatDoesCompanyDo).toBe("Makes parts");
    expect(parsed.accountingSoftware).toBe("Xero");
  });
});

describe("completeness helpers", () => {
  it("treats unanswered concentration as incomplete", () => {
    const about = {
      whatDoesCompanyDo: "A",
      mainCustomers: "B",
      singleCustomerOver50Revenue: null,
      accountingSoftware: "Xero",
    };
    expect(isAboutYourBusinessPresent(about)).toBe(true);
    expect(isAboutYourBusinessComplete(about)).toBe(false);
  });

  it("is complete when all four fields are set", () => {
    expect(
      isAboutYourBusinessComplete({
        whatDoesCompanyDo: "A",
        mainCustomers: "B",
        singleCustomerOver50Revenue: false,
        accountingSoftware: "Xero",
      })
    ).toBe(true);
  });
});
