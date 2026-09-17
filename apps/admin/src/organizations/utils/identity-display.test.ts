import { formatAdminIdentityDisplay } from "./identity-display";

describe("formatAdminIdentityDisplay (Admin personal KYC identity rendering)", () => {
  it("formats known document types safely (NRIC/PASSPORT/DRIVER_LICENSE)", () => {
    expect(
      formatAdminIdentityDisplay({
        documentType: "NRIC",
        documentNumber: "800101011234",
        identityNumberRequiredMissing: false,
      }).identityPrefixValue
    ).toBe("NRIC");

    expect(
      formatAdminIdentityDisplay({
        documentType: "PASSPORT",
        documentNumber: "A1234567",
        identityNumberRequiredMissing: false,
      }).identityPrefixValue
    ).toBe("Passport");

    expect(
      formatAdminIdentityDisplay({
        documentType: "DRIVER_LICENSE",
        documentNumber: "SOME_NUMBER",
        identityNumberRequiredMissing: false,
      }).identityPrefixValue
    ).toBe("Driving License");
  });

  it("preserves unknown document types safely by replacing underscores", () => {
    expect(
      formatAdminIdentityDisplay({
        documentType: "SOME_UNKNOWN_TYPE",
        documentNumber: "123",
        identityNumberRequiredMissing: false,
      }).identityPrefixValue
    ).toBe("SOME UNKNOWN TYPE");
  });

  it("shows 'Driving License' prefix and 'Please fill up' for blank driving-license document number", () => {
    const res = formatAdminIdentityDisplay({
      documentType: "DRIVER_LICENSE",
      documentNumber: null,
      identityNumberRequiredMissing: true,
    });

    expect(res.identityPrefixValue).toBe("Driving License");
    expect(res.identityNumberValue).toBe("Please fill up");
  });
});

