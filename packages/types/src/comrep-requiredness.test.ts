import {
  identityFormatIssue,
  optionalEmailIssue,
  requiredEmailIssue,
  requiredEnumIssue,
  requiredIntegerIssue,
  requiredPhoneIssue,
  requiredPostcodeIssue,
  requiredTextIssue,
  validateIssuerAddressForm,
  validateIssuerCompanyForm,
  validateIssuerContactPersonForm,
  validateIssuerMasterPatch,
  validateIssuerPersonForm,
  validateOperatorGeneral,
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

  it("blocks issuer contact Save when E-mail Address is blank", () => {
    const issues = validateIssuerContactPersonForm({
      email: "",
      contact: "+60123456789",
    });
    expect(issues.map((issue) => issue.field)).toContain("contactPersonEmail");
  });

  it("does not require company-level E-mail Address on Company Details", () => {
    const issues = validateIssuerCompanyForm({
      scCompanyType: "PRIVATE_LIMITED",
      dateOfIncorporation: "2020-01-01",
      dateOfCommencement: "2020-02-01",
      countryOfIncorporation: "MALAYSIA",
    });
    expect(issues.map((issue) => issue.field)).not.toContain("companyEmail");
    expect(issues.map((issue) => issue.field)).not.toContain("contactPersonEmail");
  });

  it("allows PATCH omit of required fields and rejects explicit clear of dates", () => {
    expect(validateIssuerMasterPatch({ website: "https://acme.test" }, "issuer")).toEqual([]);
    expect(
      validateIssuerMasterPatch({ dateOfIncorporation: null }, "issuer").map((issue) => issue.field)
    ).toEqual(["dateOfIncorporation"]);
    expect(validateIssuerMasterPatch({ scCompanyType: "PRIVATE_LIMITED" }, "issuer")).toEqual([]);
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

describe("secondary-onboarding field messages", () => {
  it("CASE A: company registration uses ComRep alphanumeric format, including 12-digit and legacy ROC", () => {
    expect(identityFormatIssue("202501447890", "ROC", "registrationNumber", "Company Registration Number")).toBeNull();
    expect(identityFormatIssue("1234567A", "ROC", "registrationNumber", "Company Registration Number")).toBeNull();
    expect(
      identityFormatIssue("2025-01447890", "ROC", "registrationNumber", "Company Registration Number")?.message
    ).toBe("Company Registration Number must not include dashes, spaces, or special characters.");
  });

  it("CASE F: optional email shows a human message and does not flag a blank value", () => {
    expect(optionalEmailIssue("", "email", "Email")).toBeNull();
    expect(optionalEmailIssue("ops@acme.test", "email", "Email")).toBeNull();
    expect(optionalEmailIssue("not-an-email", "email", "Email")?.message).toBe("Enter a valid e-mail address.");
  });

  it("CASE D: local Malaysian contact numbers are valid", () => {
    expect(requiredPhoneIssue("0182316817", "responsiblePersonPhone", "Contact Number")).toBeNull();
    expect(requiredPhoneIssue("not-a-phone", "responsiblePersonPhone", "Contact Number")?.message).toBe(
      "Enter a valid contact number."
    );
    expect(requiredPhoneIssue("abc", "phoneNumber", "Phone Number")?.message).toBe("Enter a valid phone number.");
  });

  it("does not invent a 12-digit-only rule for Shoraka company registration", () => {
    const issues = validateOperatorGeneral({
      name: "CashSouk",
      registrationNumber: "1234567A",
      scCompanyType: "PRIVATE_LIMITED",
      responsiblePersonName: "Ahmad",
      responsiblePersonPhone: "0182316817",
    });
    expect(issues).toEqual([]);
  });

  it("rejects trustee registration punctuation when the field is filled", () => {
    const issues = validateOperatorGeneral({
      name: "CashSouk",
      registrationNumber: "202501447890",
      trusteeRegistrationNumber: "2025-01447890",
      scCompanyType: "PRIVATE_LIMITED",
      responsiblePersonName: "Ahmad",
      responsiblePersonPhone: "+60182316817",
    });
    expect(issues.map((issue) => issue.field)).toContain("trusteeRegistrationNumber");
  });

  it("rejects shareholding above 100% without changing the 5% floor", () => {
    const issues = validateIssuerPersonForm({
      entityType: "INDIVIDUAL",
      name: "Ali",
      identityPrefix: "NRIC",
      identityNumber: "800101011234",
      dateOfBirth: "1980-01-01",
      gender: "MALE",
      nationality: "MALAYSIA",
      line1: "1 Jalan A",
      state: "Selangor",
      postalCode: "47800",
      isShareholder: true,
      shareType: "ORDINARY",
      shareholdingUnits: "10",
      shareholdingAmount: "10",
      shareholdingPercentage: "101",
    });
    expect(issues.map((issue) => issue.message)).toContain("Enter a percentage of 100 or less.");
  });
});

describe("annual RMO people rules vs monthly issuer people rules", () => {
  it("requires annual [03000] Date Acquired and does not require issuer Identity Prefix", () => {
    const issues = validateOperatorShareholder({
      entityType: "INDIVIDUAL",
      holderType: "SHAREHOLDER",
      name: "Aisha Tan",
      salutation: "Ms",
      identityNumber: "800101011234",
      dateOfBirth: "1980-01-01",
      nationality: "MALAYSIA",
      address: "1 Jalan Ampang",
      shareType: "ORDINARY",
      shareholdingUnits: "1000",
      shareholdingAmount: "1000",
      shareholdingPercentage: "100",
    });
    expect(issues.some((issue) => issue.field === "dateAcquired")).toBe(true);
    expect(issues.some((issue) => issue.field === "identityPrefix")).toBe(false);
    expect(issues.some((issue) => issue.field === "shareholdingUnits")).toBe(false);
  });
});
