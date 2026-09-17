import { formatAdminIdentityDisplay } from "./identity-display";

describe("formatAdminIdentityDisplay (Admin personal KYC identity rendering)", () => {
  it("shows DRIVER_LICENSE prefix and 'Please fill up' for blank driving-license document number", () => {
    const res = formatAdminIdentityDisplay({
      documentType: "DRIVER_LICENSE",
      documentNumber: null,
      identityNumberRequiredMissing: true,
    });

    expect(res.identityPrefixValue).toBe("DRIVER_LICENSE");
    expect(res.identityNumberValue).toBe("Please fill up");
  });
});

