import {
  buildCurlecCheckoutContactFromParties,
  normalizeCheckoutPhone,
  resolveCurlecCheckoutContact,
  selectOrganizationMemberEmail,
} from "./curlec-checkout-contact";

describe("resolveCurlecCheckoutContact", () => {
  it("uses explicitly supplied email first", () => {
    const result = resolveCurlecCheckoutContact({
      explicitEmail: "explicit@example.com",
      memberEmail: "member@example.com",
      userEmail: "user@example.com",
    });
    expect(result).toEqual({ email: "explicit@example.com" });
  });

  it("falls back from missing organisation-member email to authenticated user email", () => {
    const result = resolveCurlecCheckoutContact({
      memberEmail: "  ",
      userEmail: "investor@example.com",
    });
    expect(result).toEqual({ email: "investor@example.com" });
  });

  it("ignores empty email", () => {
    const result = resolveCurlecCheckoutContact({
      explicitEmail: "",
      memberEmail: null,
      userEmail: undefined,
    });
    expect(result.email).toBeUndefined();
  });

  it("does not pass invalid or placeholder email", () => {
    const result = resolveCurlecCheckoutContact({
      memberEmail: "not-an-email",
      userEmail: "invitation-123@cashsouk.com",
      organisationEmail: "also-bad@",
    });
    expect(result.email).toBeUndefined();
  });

  it("uses real member phone when available", () => {
    const result = resolveCurlecCheckoutContact({
      memberPhone: " +60123456789 ",
      userPhone: "+60987654321",
      organisationPhone: "+60111111111",
    });
    expect(result).toEqual({ contact: "+60123456789" });
  });

  it("falls back to authenticated user phone", () => {
    const result = resolveCurlecCheckoutContact({
      organisationPhone: "+60000000000",
      userPhone: "+60198887766",
    });
    expect(result).toEqual({ contact: "+60198887766" });
  });

  it("never passes +60000000000", () => {
    const result = resolveCurlecCheckoutContact({
      explicitPhone: "+60000000000",
      memberPhone: "+60000000000",
      userPhone: "+60000000000",
      organisationPhone: "+60000000000",
    });
    expect(result.contact).toBeUndefined();
    expect(normalizeCheckoutPhone("+60000000000")).toBeUndefined();
  });

  it("omits contact when phone is missing", () => {
    const result = resolveCurlecCheckoutContact({
      userEmail: "payer@example.com",
      organisationPhone: "   ",
    });
    expect(result).toEqual({ email: "payer@example.com" });
    expect(result).not.toHaveProperty("contact");
  });

  it("omits email when email is missing", () => {
    const result = resolveCurlecCheckoutContact({
      organisationPhone: "+60123456789",
    });
    expect(result).toEqual({ contact: "+60123456789" });
    expect(result).not.toHaveProperty("email");
  });
});

describe("buildCurlecCheckoutContactFromParties", () => {
  it("investor deposit uses authenticated investor email when member email is missing", () => {
    const result = buildCurlecCheckoutContactFromParties({
      organization: {
        members: [{ role: "ORGANIZATION_ADMIN", email: "" }],
        phoneNumber: "+60000000000",
      },
      user: {
        email: "investor.user@example.com",
        phone: "+60112223333",
      },
    });

    expect(result).toEqual({
      email: "investor.user@example.com",
      contact: "+60112223333",
    });
  });

  it("issuer onboarding flow still passes valid contact details", () => {
    const result = buildCurlecCheckoutContactFromParties({
      organization: {
        members: [
          { role: "ORGANIZATION_MEMBER", email: "member@issuer.com" },
          { role: "ORGANIZATION_ADMIN", email: "admin@issuer.com" },
        ],
        phoneNumber: "+60165554433",
        name: "Issuer Sdn Bhd",
      },
      user: {
        email: "logged-in@issuer.com",
        phone: "+60170001111",
      },
    });

    expect(result).toEqual({
      email: "admin@issuer.com",
      contact: "+60170001111",
    });
  });

  it("application-fee flow still passes valid contact details from authenticated issuer", () => {
    const result = buildCurlecCheckoutContactFromParties({
      organization: {
        members: [],
        phoneNumber: null,
        name: "Applicant Co",
      },
      user: {
        email: "applicant@issuer.com",
        phone: "+60181112222",
      },
    });

    expect(result).toEqual({
      email: "applicant@issuer.com",
      contact: "+60181112222",
    });
  });

  it("investor deposit checkout contact can open without a phone", () => {
    const result = buildCurlecCheckoutContactFromParties({
      organization: {
        members: [],
        phoneNumber: "+60000000000",
      },
      user: {
        email: "investor@example.com",
        phone: null,
      },
    });

    expect(result).toEqual({ email: "investor@example.com" });
    expect(result).not.toHaveProperty("contact");
  });

  it("selects organisation admin member email", () => {
    expect(
      selectOrganizationMemberEmail([
        { role: "ORGANIZATION_MEMBER", email: "member@example.com" },
        { role: "ORGANIZATION_ADMIN", email: "admin@example.com" },
      ])
    ).toBe("admin@example.com");
  });
});
