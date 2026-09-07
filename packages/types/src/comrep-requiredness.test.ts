import {
  identityFormatIssue,
  requiredEmailIssue,
  requiredEnumIssue,
  requiredIntegerIssue,
  requiredPostcodeIssue,
  requiredTextIssue,
  validateIssuerAddressForm,
  validateIssuerCompanyForm,
  validateIssuerMasterPatch,
  validateIssuerPersonForm,
  validateOperatorShareCapital,
  validateOperatorShareholder,
} from "./comrep-requiredness";
import { SC_COMPANY_TYPES, SC_SHARE_TYPES } from "./comrep-profile";

describe("ComRep requiredness", () => {
  it("rejects blank, whitespace, and null required text", () => {
    expect(requiredTextIssue("Acme", "name", "Name of Issuer")).toBeNull();
    expect(requiredTextIssue("", "name", "Name of Issuer")?.message).toBe("Name of Issuer is required.");
    expect(requiredTextIssue("   ", "name", "Name of Issuer")?.message).toBe("Name of Issuer is required.");
    expect(requiredTextIssue(null, "name", "Name of Issuer")?.message).toBe("Name of Issuer is required.");
  });

  it("requires a valid E-mail Address", () => {
    expect(requiredEmailIssue("ops@acme.test", "companyEmail", "E-mail Address")).toBeNull();
    expect(requiredEmailIssue("", "companyEmail", "E-mail Address")?.message).toBe("E-mail Address is required.");
    expect(requiredEmailIssue("   ", "companyEmail", "E-mail Address")?.message).toBe(
      "E-mail Address is required."
    );
    expect(requiredEmailIssue("not-an-email", "companyEmail", "E-mail Address")?.message).toBe(
      "Enter a valid e-mail address."
    );
  });

  it("rejects empty and unknown enums", () => {
    expect(requiredEnumIssue("PRIVATE_LIMITED", SC_COMPANY_TYPES, "scCompanyType", "Type of Company")).toBeNull();
    expect(requiredEnumIssue("", SC_COMPANY_TYPES, "scCompanyType", "Type of Company")?.message).toBe(
      "Select a Type of Company."
    );
    expect(requiredEnumIssue("LLC", SC_COMPANY_TYPES, "scCompanyType", "Type of Company")?.message).toMatch(
      /Select a valid/
    );
  });

  it("blocks issuer company Save when E-mail Address is blank", () => {
    const issues = validateIssuerCompanyForm({
      scCompanyType: "PRIVATE_LIMITED",
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "MALAYSIA",
      companyEmail: "",
      phoneNumber: "+60123456789",
    });
    expect(issues.map((issue) => issue.field)).toContain("companyEmail");
  });

  it("allows PATCH omit of required fields and rejects explicit clear", () => {
    expect(validateIssuerMasterPatch({ website: "https://acme.test" }, "issuer")).toEqual([]);
    expect(
      validateIssuerMasterPatch({ companyEmail: null }, "issuer").map((issue) => issue.field)
    ).toEqual(["companyEmail"]);
    expect(
      validateIssuerMasterPatch({ companyEmail: "   " }, "issuer").map((issue) => issue.field)
    ).toEqual(["companyEmail"]);
    expect(validateIssuerMasterPatch({ companyEmail: "ops@acme.test" }, "issuer")).toEqual([]);
  });

  it("requires Type of Shares - Others only when Others is selected", () => {
    const blankOther = validateOperatorShareholder({
      entityType: "INDIVIDUAL",
      name: "Ali",
      salutation: "Mr",
      identityNumber: "800101011234",
      dateOfBirth: "1980-01-01",
      nationality: "MALAYSIA",
      address: "1 Jalan A",
      dateAcquired: "2020-01-01",
      shareType: "OTHERS",
      shareTypeOther: "",
      shareholdingUnits: "10",
      shareholdingAmount: "10",
      shareholdingPercentage: "10",
    });
    expect(blankOther.map((issue) => issue.field)).toContain("shareTypeOther");

    const ordinary = validateOperatorShareholder({
      entityType: "INDIVIDUAL",
      name: "Ali",
      salutation: "Mr",
      identityNumber: "800101011234",
      dateOfBirth: "1980-01-01",
      nationality: "MALAYSIA",
      address: "1 Jalan A",
      dateAcquired: "2020-01-01",
      shareType: "ORDINARY",
      shareTypeOther: "",
      shareholdingUnits: "10",
      shareholdingAmount: "10",
      shareholdingPercentage: "10",
    });
    expect(ordinary.map((issue) => issue.field)).not.toContain("shareTypeOther");
    expect(ordinary).toHaveLength(0);
    expect(SC_SHARE_TYPES).toContain("OTHERS");
  });

  it("does not require Members' Reserves", () => {
    const issues = validateOperatorShareCapital(
      {
        llpMembersCapitalUnits: "50",
        llpMembersCapitalAmount: "50",
        llpSubordinatedLoansUnits: "0",
        llpSubordinatedLoansAmount: "0",
        totalLlp: "50",
      },
      "LLP"
    );
    expect(issues).toHaveLength(0);
  });

  it("rejects NRIC/ROC with dashes and does not strip Passport the same way", () => {
    expect(identityFormatIssue("800101-01-1234", "NRIC", "identityNumber", "IC/Passport number")?.message).toMatch(
      /dashes/
    );
    expect(identityFormatIssue("1234567-A", "ROC", "registrationNumber", "Issuer ROC")?.message).toMatch(
      /dashes/
    );
    expect(identityFormatIssue("A1234567", "PASSPORT", "identityNumber", "IC/Passport number")).toBeNull();
    expect(identityFormatIssue("AB-12 34", "PASSPORT", "identityNumber", "IC/Passport number")).toBeNull();
  });

  it("rejects share-count decimals where SC requires integer without decimal points", () => {
    expect(requiredIntegerIssue("50.5", "ordinaryUnits", "Ordinary (for Sdn Bhd) — No. of Shares")?.message).toMatch(
      /whole number/
    );
    expect(requiredIntegerIssue("50", "ordinaryUnits", "Ordinary (for Sdn Bhd) — No. of Shares")).toBeNull();
    const issues = validateOperatorShareCapital(
      {
        ordinaryUnits: "50.5",
        ordinaryAmount: "50",
        preferenceUnits: "0",
        preferenceAmount: "0",
        othersUnits: "0",
        othersAmount: "0",
        totalPaidUpCapital: "50",
      },
      "SDN_BHD"
    );
    expect(issues.map((issue) => issue.field)).toContain("ordinaryUnits");
  });

  it("waives postcode when State is Outside Malaysia", () => {
    expect(requiredPostcodeIssue("", "Outside Malaysia", "postalCode", "Registered Address - Postcode")).toBeNull();
    expect(requiredPostcodeIssue("", "Selangor", "postalCode", "Registered Address - Postcode")?.message).toBe(
      "Registered Address - Postcode is required."
    );
    const issues = validateIssuerAddressForm({
      registeredLine1: "1 Street",
      registeredState: "Outside Malaysia",
      registeredPostalCode: "",
      businessLine1: "2 Street",
      businessState: "Selangor",
      businessPostalCode: "50000",
    });
    expect(issues.map((issue) => issue.field)).not.toContain("registeredPostalCode");
  });
});

describe("validateIssuerPersonForm roles", () => {
  const identity = {
    entityType: "INDIVIDUAL" as const,
    name: "Random 1",
    identityPrefix: "NRIC",
    identityNumber: "021116101341",
    dateOfBirth: "2002-11-16",
    gender: "MALE",
    nationality: "MALAYSIA",
    line1: "12341",
    state: "Kelantan",
    postalCode: "12341",
  };
  const officerFields = {
    designation: "CHIEF_EXECUTIVE_OFFICER",
    appointmentDate: "2026-09-25",
  };
  const shareFields = {
    shareType: "ORDINARY",
    shareholdingUnits: "10",
    shareholdingAmount: "10",
    shareholdingPercentage: "6",
  };

  it("CASE A: Director only does not require personKind or Board fields", () => {
    const issues = validateIssuerPersonForm({
      ...identity,
      isShareholder: false,
      isOfficer: false,
    });
    expect(issues.map((issue) => issue.field)).not.toContain("personKind");
    expect(issues.map((issue) => issue.field)).not.toContain("designation");
    expect(issues).toHaveLength(0);
  });

  it("CASE B/C: Board or Management requires Designation and Appointment Date once", () => {
    expect(
      validateIssuerPersonForm({
        ...identity,
        isOfficer: true,
        ...officerFields,
      })
    ).toHaveLength(0);
    const missingDesignation = validateIssuerPersonForm({
      ...identity,
      isOfficer: true,
      appointmentDate: "2026-09-25",
    });
    expect(missingDesignation.map((issue) => issue.field)).toEqual(["designation"]);
    expect(missingDesignation[0]?.message).toBe("Select a Designation.");
    expect(missingDesignation.map((issue) => issue.field)).not.toContain("personKind");
  });

  it("CASE D: Director + Board + Management does not require personKind", () => {
    const issues = validateIssuerPersonForm({
      ...identity,
      isShareholder: false,
      isOfficer: true,
      ...officerFields,
    });
    expect(issues.map((issue) => issue.field)).not.toContain("personKind");
    expect(issues).toHaveLength(0);
  });

  it("CASE E: Director + Shareholder does not require Board fields", () => {
    const issues = validateIssuerPersonForm({
      ...identity,
      isShareholder: true,
      isOfficer: false,
      ...shareFields,
    });
    expect(issues.map((issue) => issue.field)).not.toContain("personKind");
    expect(issues.map((issue) => issue.field)).not.toContain("designation");
    expect(issues).toHaveLength(0);
  });
});
